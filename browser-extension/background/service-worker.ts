import { api, setToken, getToken } from '../lib/api';
import {
  mnemonicToSeed as bip39MnemonicToSeed,
  deriveWithHKDF,
  derivePairingId,
  unwrapKey,
  decryptPayload,
  encryptPayload,
  wrapKey,
  hexToBytes,
  bytesToHex,
  randomBytes,
  type WrappedKey,
  type EncryptedEnvelope,
} from '../lib/crypto';
import { storeVaultItems, setMeta, getMeta, clearVault } from '../lib/storage';
import type { VaultItem, DecryptedVaultItem, VaultSeedData } from '../lib/types';

const AUTO_LOCK_DELAY_MINUTES = 15;
const AUTO_LOCK_ALARM = 'zerovault-auto-lock';

interface VaultState {
  cipherKey: Uint8Array | null;
  cipherKeyBytes: number;
  signKey: Uint8Array | null;
  signKeyBytes: number;
  syncing: boolean;
  lastSyncId: number;
  lastActivity: number;
}

const state: VaultState = {
  cipherKey: null,
  cipherKeyBytes: 0,
  signKey: null,
  signKeyBytes: 0,
  syncing: false,
  lastSyncId: 0,
  lastActivity: Date.now(),
};

function zeroKey(key: Uint8Array | null): void {
  if (key && key.length > 0) {
    key.fill(0);
  }
}

function lockVault(): void {
  zeroKey(state.cipherKey);
  zeroKey(state.signKey);
  state.cipherKey = null;
  state.signKey = null;
  state.cipherKeyBytes = 0;
  state.signKeyBytes = 0;
  state.lastSyncId = 0;
}

function resetAutoLock(): void {
  state.lastActivity = Date.now();
  chrome.alarms.clear(AUTO_LOCK_ALARM);
  chrome.alarms.create(AUTO_LOCK_ALARM, { delayInMinutes: AUTO_LOCK_DELAY_MINUTES });
}

function parseWrapped(w: { iv: string; ciphertext: string; tag: string }): WrappedKey {
  return {
    iv: hexToBytes(w.iv),
    ciphertext: hexToBytes(w.ciphertext),
    tag: hexToBytes(w.tag),
  };
}

async function unlockWithMnemonic(mnemonic: string): Promise<boolean> {
  try {
    const seed = bip39MnemonicToSeed(mnemonic);
    const recoveryKey = deriveWithHKDF(seed, 'zerovault-recovery-wrap-v1');

    let seedData: VaultSeedData;
    try {
      // Try cross-device pairing first (same mnemonic → same pairing_id)
      const pairingId = derivePairingId(seed);
      try {
        seedData = await api.pullSeedByPairing(pairingId) as VaultSeedData;
      } catch {
        // Fallback to per-user seed (same device or manually imported)
        seedData = await api.pullVaultSeed() as VaultSeedData;
      }
      if (!seedData || !seedData.wrappedCipherKey) {
        recoveryKey.fill(0);
        seed.fill(0);
        return false;
      }
    } catch {
      recoveryKey.fill(0);
      seed.fill(0);
      return false;
    }

    seed.fill(0);

    const cipherKey = unwrapKey(parseWrapped({
      iv: seedData.wrappedCipherKey.slice(0, 48),
      ciphertext: seedData.wrappedCipherKey.slice(48, 96),
      tag: seedData.wrappedCipherKey.slice(96) || '00',
    }), recoveryKey);

    recoveryKey.fill(0);

    if (!cipherKey || cipherKey.length !== 32) {
      zeroKey(cipherKey);
      return false;
    }

    state.cipherKey = cipherKey;
    state.cipherKeyBytes = cipherKey.length;
    state.signKey = null;
    state.signKeyBytes = 0;
    state.lastActivity = Date.now();

    await setMeta('mnemonic_hash', 'set');
    resetAutoLock();
    return true;
  } catch {
    return false;
  }
}

async function syncVault(): Promise<void> {
  if (state.syncing || !state.cipherKey) return;
  state.syncing = true;

  try {
    const lastIdStr = await getMeta('last_sync_id');
    let sinceId = lastIdStr ? parseInt(lastIdStr, 10) : 0;

    while (true) {
      const result = await api.pull(sinceId, 200);
      if (!result.logs || result.logs.length === 0) break;

      for (const log of result.logs) {
        if (!state.cipherKey) continue;

        try {
          const raw = JSON.parse(log.payload_ciphertext);
          if (!raw.envelope && !raw.ct) continue;

          const envelope: EncryptedEnvelope = raw.envelope || {
            v: raw.v || 1,
            alg: raw.alg || 'xchacha20-poly1305',
            iv: raw.iv,
            ct: raw.ct,
            tag: raw.tag,
            aad: raw.aad || '{}',
          };

          const plaintext = decryptPayload(envelope, state.cipherKey);
          if (!plaintext.id) continue;

          const item: VaultItem = {
            id: plaintext.id as string,
            itemType: (plaintext.itemType as any) || 'password',
            title: (plaintext.title as string) || 'Untitled',
            folder: (plaintext.folder as string) || null,
            payloadCiphertext: JSON.stringify(envelope),
            favorite: (plaintext.favorite as boolean) || false,
            icon: (plaintext.icon as string) || null,
            urlHint: (plaintext.urlHint as string) || null,
            lastUsedAt: (plaintext.lastUsedAt as number) || null,
            createdAt: (plaintext.createdAt as number) || Date.now(),
            updatedAt: Date.now(),
            isPendingDelete: log.operation === 'DELETE',
          };

          await storeVaultItems([item]);
          sinceId = log.id;
        } catch {
          // Corrupted log entry — skip
        }
      }

      await setMeta('last_sync_id', String(sinceId));
      if (!result.hasMore) break;
    }

    state.lastSyncId = sinceId;
  } catch {
    // Sync failure is non-fatal
  } finally {
    state.syncing = false;
  }
}

async function decryptItemsForUI(): Promise<DecryptedVaultItem[]> {
  if (!state.cipherKey) return [];

  try {
    const { getVaultItems, decryptWithKey } = await import('../lib/storage');
    const items = await getVaultItems();
    return decryptWithKey(items, state.cipherKey);
  } catch {
    return [];
  }
}

async function queryAutofill(url: string): Promise<Array<{ id: string; title: string; username: string; password: string; urlHint: string }>> {
  if (!state.cipherKey) return [];

  try {
    const domain = new URL(url).hostname;
    const { getVaultItems, decryptWithKey } = await import('../lib/storage');
    const items = await getVaultItems();
    const decrypted = await decryptWithKey(items, state.cipherKey);

    return decrypted
      .filter((item) => {
        if (item.itemType !== 'password') return false;
        const hint = item.urlHint || '';
        return hint.includes(domain) || domain.includes(hint.replace(/^https?:\/\//, '')) || ((item.payload as any).url || '').includes(domain);
      })
      .slice(0, 8)
      .map((item) => ({
        id: item.id,
        title: item.title,
        username: (item.payload as any).username || '',
        password: (item.payload as any).password || '',
        urlHint: item.urlHint || '',
      }));
  } catch {
    return [];
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true;
});

async function handleMessage(msg: { type: string; data?: any }): Promise<any> {
  if (state.cipherKey) {
    resetAutoLock();
  }

  switch (msg.type) {
    case 'GET_STATUS':
      return {
        authenticated: !!getToken(),
        unlocked: state.cipherKey !== null,
        lastSyncId: state.lastSyncId,
      };

    case 'ANON_SIGN_IN':
      try {
        await api.anonSignIn();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'UNLOCK_WITH_MNEMONIC':
      try {
        const ok = await unlockWithMnemonic(msg.data.mnemonic);
        if (ok) {
          syncVault().catch(() => {});
        }
        return { success: ok };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'GET_ITEMS': {
      if (!state.cipherKey) return { items: [], locked: true };
      const items = await decryptItemsForUI();
      return { items, locked: false };
    }

    case 'SYNC_NOW':
      await syncVault();
      return { success: true };

    case 'LOCK':
      lockVault();
      await clearVault();
      chrome.alarms.clear(AUTO_LOCK_ALARM);
      return { success: true };

    case 'AUTOFILL_QUERY': {
      if (!state.cipherKey) return { matches: [] };
      const matches = await queryAutofill(msg.data?.url || '');
      return { matches };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTO_LOCK_ALARM) {
    lockVault();
    clearVault().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(() => {
  lockVault();
});

chrome.runtime.onStartup.addListener(() => {
  lockVault();
});

setInterval(() => {
  if (state.cipherKey) {
    syncVault().catch(() => {});
  }
}, 60_000);
