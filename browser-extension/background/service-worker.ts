import { api, setToken, getToken } from '../lib/api';
import {
  mnemonicToSeed as bip39MnemonicToSeed,
  deriveWithHKDF,
  derivePairingId,
  deriveDeviceCredentials,
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
import { SecureBuffer } from '../../lib/crypto/secure-buffer';
import { storeVaultItems, setMeta, getMeta, clearVault, getVaultConfig, setVaultConfig, getVaultItems, decryptWithKey } from '../lib/storage';
import type { VaultItem, DecryptedVaultItem, VaultSeedData } from '../lib/types';

const AUTO_LOCK_DELAY_MINUTES = 15;
const AUTO_LOCK_ALARM = 'zerovault-auto-lock';

interface VaultState {
  cipherKey: any | null;
  cipherKeyBytes: number;
  signKey: any | null;
  signKeyBytes: number;
  syncing: boolean;
  syncPending: boolean;
  lastSyncId: number;
  lastActivity: number;
}

const state: VaultState = {
  cipherKey: null,
  cipherKeyBytes: 0,
  signKey: null,
  signKeyBytes: 0,
  syncing: false,
  syncPending: false,
  lastSyncId: 0,
  lastActivity: Date.now(),
};


function lockVault(): void {
  if (state.cipherKey) state.cipherKey.dispose();
  if (state.signKey) state.signKey.dispose();
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

// Helper: Derive a local wrapping key from the user's extension password
async function deriveLocalWrapKey(password: string, saltHex: string): Promise<SecureBuffer> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const salt = hexToBytes(saltHex);
  
  // Use PBKDF2 via WebCrypto for the local password derivation
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 210000,
      hash: 'SHA-256'
    },
    baseKey,
    256 // 32 bytes
  );

  return SecureBuffer.from(new Uint8Array(derivedBits));
}

async function setupWithMnemonic(mnemonic: string, password: string): Promise<boolean> {
  try {
    const seed = bip39MnemonicToSeed(mnemonic);
    const pairingId = derivePairingId(seed);
    const recoveryKey = deriveWithHKDF(seed, 'zerovault-recovery-wrap-v1');

    const creds = deriveDeviceCredentials(pairingId);
    try {
      await api.signIn(creds.email, creds.password);
    } catch (e: any) {
      recoveryKey.fill(0);
      seed.fill(0);
      throw new Error('Sign-in failed: ' + (e?.message || 'unknown'));
    }

    let seedData: VaultSeedData;
    try {
      seedData = await api.pullSeedByPairing(pairingId) as VaultSeedData;
    } catch (e: any) {
      recoveryKey.fill(0);
      seed.fill(0);
      throw new Error(`pullSeed failed: ${e.message}`);
    }

    if (!seedData || !seedData.wrappedCipherKey) {
      recoveryKey.fill(0);
      seed.fill(0);
      throw new Error(`Seed data missing or incomplete: ${JSON.stringify(seedData)}`);
    }

    const cipherKey = deriveWithHKDF(seed, 'zerovault-deterministic-cipher-v1');

    recoveryKey.fill(0);
    seed.fill(0);

    if (!cipherKey || cipherKey.length !== 32) {
      if (cipherKey) cipherKey.fill(0);
      throw new Error('cipherKey derivation failed');
    }

    // Wrap the cipherKey with the local password for storage
    const localSalt = bytesToHex(randomBytes(16));
    const localWrapKey = await deriveLocalWrapKey(password, localSalt);
    
    const localWrappedCipherKey = wrapKey(cipherKey, localWrapKey.copy());
    localWrapKey.dispose();

    await setVaultConfig({
      pairingId,
      wrappedCipherKey: {
        iv: bytesToHex(localWrappedCipherKey.iv),
        ciphertext: bytesToHex(localWrappedCipherKey.ciphertext),
        tag: bytesToHex(localWrappedCipherKey.tag)
      },
      localSalt
    });

    state.cipherKey = SecureBuffer.from(cipherKey);
    state.cipherKeyBytes = 32;
    state.signKey = null;
    state.signKeyBytes = 0;
    state.lastActivity = Date.now();

    await setMeta('mnemonic_hash', 'set');
    resetAutoLock();
    return true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

async function unlockWithPassword(password: string): Promise<boolean> {
  try {
    const config = await getVaultConfig();
    if (!config) return false;

    const creds = deriveDeviceCredentials(config.pairingId);
    try {
      await api.signIn(creds.email, creds.password);
    } catch (e: any) {
      throw new Error('Sign-in failed: ' + (e?.message || 'unknown'));
    }

    const localWrapKey = await deriveLocalWrapKey(password, config.localSalt);
    
    const cipherKey = unwrapKey(
      parseWrapped(config.wrappedCipherKey),
      localWrapKey.copy()
    );
    localWrapKey.dispose();

    if (!cipherKey || cipherKey.length !== 32) {
      if (cipherKey) cipherKey.fill(0);
      return false;
    }

    state.cipherKey = SecureBuffer.from(cipherKey);
    state.cipherKeyBytes = 32;
    state.signKey = null;
    state.signKeyBytes = 0;
    state.lastActivity = Date.now();

    state.lastSyncId = 0;
    await setMeta('last_sync_id', '0');

    resetAutoLock();
    return true;
  } catch (e: any) {
    console.error(e);
    throw new Error('Unlock error: ' + (e?.message || 'unknown'));
  }
}

async function syncVault(): Promise<void> {
  if (state.syncing || !state.cipherKey || state.cipherKey.disposed) {
    state.syncPending = true;
    return;
  }
  state.syncing = true;
  state.syncPending = false;

  try {
    await doSyncVault();
  } finally {
    state.syncing = false;
    if (state.syncPending) {
      state.syncPending = false;
      syncVault();
    }
  }
}

async function doSyncVault(): Promise<void> {
  try {
    const lastIdStr = await getMeta('last_sync_id');
    let sinceId = lastIdStr ? parseInt(lastIdStr, 10) : 0;

    while (true) {
      const result = await api.pull(sinceId, 200);
      if (!result.logs || result.logs.length === 0) break;

      for (const log of result.logs) {
        if (!state.cipherKey || state.cipherKey.disposed) continue;

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

          const cipherKeyBuf = state.cipherKey!.copy();
          let plaintext: any = null;

          if (raw.wrappedDek) {
            const wDekStr = typeof raw.wrappedDek === 'string' ? JSON.parse(raw.wrappedDek) : raw.wrappedDek;
            const wrappedDek = {
              iv: hexToBytes(wDekStr.iv),
              ciphertext: hexToBytes(wDekStr.ciphertext),
              tag: hexToBytes(wDekStr.tag)
            };
            const dek = unwrapKey(wrappedDek, cipherKeyBuf);
            if (dek) {
              plaintext = decryptPayload(envelope, dek);
              dek.fill(0);
            }
          } else {
            plaintext = decryptPayload(envelope, cipherKeyBuf);
          }

          if (!plaintext || !plaintext.id) {
            cipherKeyBuf.fill(0);
            continue;
          }

          // Re-encrypt the payload locally with the main cipherKey so it can be decrypted easily
          const localPayload = plaintext.payload || plaintext;
          const newEnvelope = encryptPayload(localPayload, cipherKeyBuf);
          cipherKeyBuf.fill(0);

          const item: VaultItem = {
            id: plaintext.id as string,
            itemType: (plaintext.itemType as any) || 'password',
            title: (plaintext.title as string) || 'Untitled',
            folder: (plaintext.folder as string) || null,
            payloadCiphertext: JSON.stringify(newEnvelope),
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
        } catch (e: any) {
          console.error(`[Sync] Failed to process log ${log.id}: ${e instanceof Error ? e.message : String(e)}`, e);
          // Corrupted log entry — skip
        }
      }

      await setMeta('last_sync_id', String(sinceId));
      if (!result.hasMore) break;
    }

    state.lastSyncId = sinceId;
  } catch {
    // Sync failure is non-fatal
  }
}

async function decryptItemsForUI(): Promise<DecryptedVaultItem[]> {
  if (!state.cipherKey || state.cipherKey.disposed) return [];

  try {
    const items = await getVaultItems();
    const keyBuf = state.cipherKey!.copy();
    try {
      return await decryptWithKey(items, keyBuf);
    } finally {
      keyBuf.fill(0);
    }
  } catch {
    return [];
  }
}

async function queryAutofill(url: string, urlHash?: string): Promise<Array<{ id: string; title: string; username: string; password: string; urlHint: string }>> {
  if (!state.cipherKey || state.cipherKey.disposed) return [];

  try {
    const domain = new URL(url).hostname;
    const { getVaultItems, decryptWithKey } = await import('../lib/storage');
    const items = await getVaultItems();
    const keyBuf = state.cipherKey!.copy();
    let decrypted: DecryptedVaultItem[];
    try {
      decrypted = await decryptWithKey(items, keyBuf);
    } finally {
      keyBuf.fill(0);
    }

    return decrypted
      .filter((item) => {
        if (item.itemType !== 'password') return false;
        
        let match = false;
        try {
          const checkMatch = (targetUrl: string) => {
            if (!targetUrl) return false;
            let normalized = targetUrl;
            if (!normalized.startsWith('http')) normalized = 'https://' + normalized;
            const targetDomain = new URL(normalized).hostname;
            return domain === targetDomain || domain.endsWith('.' + targetDomain);
          };
          
          match = checkMatch(item.urlHint || '') || checkMatch((item.payload as any).url || '');
        } catch {
          match = false;
        }
        return match;
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
  if (state.cipherKey && !state.cipherKey.disposed) {
    resetAutoLock();
  }

  switch (msg.type) {
    case 'GET_STATUS': {
      const config = await getVaultConfig();
      return {
        uninitialized: !config,
        authenticated: !!getToken(),
        unlocked: state.cipherKey !== null && !state.cipherKey.disposed,
        lastSyncId: state.lastSyncId,
      };
    }

    case 'SETUP_WITH_MNEMONIC':
      try {
        const ok = await setupWithMnemonic(msg.data.mnemonic, msg.data.password);
        if (ok) {
          syncVault().catch(() => {});
        }
        return { success: ok };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'UNLOCK_WITH_PASSWORD':
      try {
        const ok = await unlockWithPassword(msg.data.password);
        if (ok) {
          syncVault().catch(() => {});
        }
        return { success: ok };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'GET_ITEMS': {
      if (!state.cipherKey || state.cipherKey.disposed) return { items: [], locked: true };
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
      if (ws) {
        ws.close();
        ws = null;
      }
      clearTimeout(wsReconnectTimer);
      return { success: true };

    case 'AUTOFILL_QUERY': {
      if (!state.cipherKey || state.cipherKey.disposed) return { matches: [] };
      const matches = await queryAutofill(msg.data?.url || '', msg.data?.urlHash);
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
  } else if (alarm.name === 'sync-poller') {
    if (state.cipherKey && !state.cipherKey.disposed) {
      syncVault().catch(() => {});
    }
  }
});

// Legacy WebSocket functionality removed for Supabase Edge compatibility

chrome.runtime.onInstalled.addListener(() => {
  lockVault();
  chrome.alarms.create('sync-poller', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  lockVault();
  chrome.alarms.create('sync-poller', { periodInMinutes: 1 });
});
