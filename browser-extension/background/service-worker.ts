import { api, setToken, getToken } from '../lib/api';
import { mnemonicToSeed, deriveHkdfKey, type WrappedKey, unwrapKey, decryptPayload, hexToBytes } from '../lib/crypto';
import { storeVaultItems, setMeta, getMeta, clearVault } from '../lib/storage';
import type { VaultItem, SyncLogEntry, EncryptedEnvelope, VaultSeedData } from '../lib/types';

interface VaultState {
  cipherKey: Uint8Array | null;
  signKey: Uint8Array | null;
  syncing: boolean;
  lastSyncId: number;
}

const state: VaultState = {
  cipherKey: null,
  signKey: null,
  syncing: false,
  lastSyncId: 0,
};

function parseWrapped(w: { iv: string; ciphertext: string; tag: string }): WrappedKey {
  return {
    iv: hexToBytes(w.iv),
    ciphertext: hexToBytes(w.ciphertext),
    tag: hexToBytes(w.tag),
  };
}

async function unlockWithMnemonic(mnemonic: string): Promise<boolean> {
  try {
    const seed = mnemonicToSeed(mnemonic);
    const recoveryKey = deriveHkdfKey(seed, 'zerovault-recovery-wrap-v1');

    let seedData: VaultSeedData;
    try {
      seedData = await api.pullVaultSeed() as VaultSeedData;
    } catch {
      return false;
    }

    if (!seedData) return false;

    const vaultKey = unwrapKey(parseWrapped({
      iv: seedData.wrappedVaultKey.slice(0, 48),
      ciphertext: seedData.wrappedVaultKey.slice(48, 96),
      tag: seedData.wrappedVaultKey.slice(96) || '00',
    }), recoveryKey);

    // Simplified: store cipher key for decryption
    state.cipherKey = unwrapKey(parseWrapped({
      iv: seedData.wrappedCipherKey.slice(0, 48),
      ciphertext: seedData.wrappedCipherKey.slice(48, 96),
      tag: seedData.wrappedCipherKey.slice(96) || '00',
    }), recoveryKey);

    await setMeta('mnemonic_hash', 'set');
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
          if (!raw.envelope || !raw.wrappedDek) continue;

          const plaintext = decryptPayload(raw.envelope, state.cipherKey);

          if (!plaintext.id) continue;

          const item: VaultItem = {
            id: plaintext.id as string,
            itemType: (plaintext.itemType as any) || 'password',
            title: (plaintext.title as string) || 'Untitled',
            folder: (plaintext.folder as string) || null,
            payloadCiphertext: JSON.stringify(raw.envelope),
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
        } catch {}
      }

      await setMeta('last_sync_id', String(sinceId));
      if (!result.hasMore) break;
    }

    state.lastSyncId = sinceId;
  } catch (err) {
    console.error('[Background] Sync error:', err);
  } finally {
    state.syncing = false;
  }
}

// Message handlers from popup and content script
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(msg: { type: string; data?: any }): Promise<any> {
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
          await syncVault();
        }
        return { success: ok };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'GET_ITEMS':
      if (!state.cipherKey) return { items: [], locked: true };
      try {
        const { getVaultItems, decryptWithKey } = await import('../lib/storage');
        const items = await getVaultItems();
        const decrypted = await decryptWithKey(items, state.cipherKey);
        return { items: decrypted, locked: false };
      } catch (e: any) {
        return { items: [], error: e.message };
      }

    case 'SYNC_NOW':
      await syncVault();
      return { success: true };

    case 'LOCK':
      state.cipherKey = null;
      state.signKey = null;
      await clearVault();
      return { success: true };

    case 'CREATE_TEST_VAULT':
      try {
        // Generate a test vault directly in the extension
        const { generateMnemonic, mnemonicToSeed: extMnemonicToSeed } = await import('../lib/crypto');
        const testMnemonic = generateMnemonic();
        const seed = extMnemonicToSeed(testMnemonic);
        state.cipherKey = seed.slice(0, 32); // Use first 32 bytes as cipher key
        state.signKey = seed.slice(32); // Last 32 bytes as sign key

        // Create a test password item
        const { encryptPayload } = await import('../lib/crypto');
        const testPayload = encryptPayload({
          username: 'test@example.com',
          password: 'TestPassword123!',
          url: 'https://example.com',
          notes: 'Test vault item created by browser extension',
        }, state.cipherKey);

        // Store locally
        const { storeVaultItems } = await import('../lib/storage');
        const testItem: VaultItem = {
          id: `password-${Date.now()}-test`,
          itemType: 'password' as const,
          title: 'Example Login',
          folder: null,
          payloadCiphertext: JSON.stringify(testPayload),
          favorite: false,
          icon: null,
          urlHint: 'https://example.com',
          lastUsedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPendingDelete: false,
        };
        await storeVaultItems([testItem]);

        // Push to server
        await api.push([{
          entityId: testItem.id,
          entityType: 'vaultItem',
          operation: 'INSERT',
          payloadCiphertext: testItem.payloadCiphertext,
          newRevision: null,
          keyEpochId: 0,
          hlc: new Date().toISOString(),
        }]);

        // Push vault seed for cross-device sync
        const { hexToBytes: extHexToBytes, wrapKey: extWrapKey, bytesToHex: extBytesToHex, randomBytes: extRandomBytes } = await import('../lib/crypto');
        const deviceSalt = extRandomBytes(32);
        const vaultKey = extRandomBytes(32);
        const recoveryKey = state.cipherKey;
        const wrappedVaultKey = extWrapKey(vaultKey, recoveryKey);
        const wrappedCipherKey = extWrapKey(state.cipherKey, recoveryKey);
        const wrappedSignKey = extWrapKey(state.signKey, recoveryKey);

        await api.pushVaultSeed({
          deviceSalt: extBytesToHex(deviceSalt),
          wrappedVaultKey: extBytesToHex(wrappedVaultKey.iv) + extBytesToHex(wrappedVaultKey.ciphertext),
          wrappedCipherKey: extBytesToHex(wrappedCipherKey.iv) + extBytesToHex(wrappedCipherKey.ciphertext),
          wrappedSignKey: extBytesToHex(wrappedSignKey.iv) + extBytesToHex(wrappedSignKey.ciphertext),
          pinVerifyHash: extBytesToHex(deviceSalt),
        } as any);

        return { success: true, mnemonic: testMnemonic };
      } catch (e: any) {
        return { success: false, error: e.message };
      }

    case 'AUTOFILL_QUERY':
      if (!state.cipherKey) return { matches: [] };
      try {
        const url = msg.data?.url || '';
        const domain = new URL(url).hostname;
        const { getVaultItems, decryptWithKey } = await import('../lib/storage');
        const items = await getVaultItems();
        const decrypted = await decryptWithKey(items, state.cipherKey);

        const matches = decrypted
          .filter((item) => {
            if (item.itemType !== 'password') return false;
            const hint = item.urlHint || '';
            const hasMatch = hint.includes(domain) || domain.includes(hint.replace(/^https?:\/\//, ''));
            return hasMatch || (item.payload as any).url?.includes(domain);
          })
          .slice(0, 8)
          .map((item) => ({
            id: item.id,
            title: item.title,
            username: (item.payload as any).username || '',
            password: (item.payload as any).password || '',
            urlHint: item.urlHint || '',
          }));

        return { matches };
      } catch {
        return { matches: [] };
      }

    default:
      return { error: 'Unknown message type' };
  }
}

// Initial sync on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Zero Vault] Extension installed');
});

// Periodic sync
setInterval(() => {
  if (state.cipherKey) {
    syncVault().catch(() => {});
  }
}, 60_000);
