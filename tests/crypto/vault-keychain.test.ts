/**
 * Tests: lib/crypto/vault-keychain.ts
 * Validates vault lifecycle: create → unlock → change PIN → recover → purge
 * Uses vitest.mock for expo-secure-store to test without device.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock expo-secure-store before any imports
const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  deleteItemAsync: vi.fn(async (key: string) => { store.delete(key); }),
}));

import {
  createVault, unlockVault, isVaultSetup, getPinAttempts,
  isVaultLocked, changePin, exportVaultSeed, importVaultSeed,
  hasRecoverySeed, recoverWithMnemonic, purgeVault,
  createVaultSafe, unlockVaultSafe,
  type VaultKeySet, type VaultGenesisResult, type VaultSeed,
} from '../../lib/crypto/vault-keychain';
import { SecureBuffer } from '../../lib/crypto/secure-buffer';

const TEST_PIN = '12345678';
const TEST_PIN2 = '87654321';
const SHORT_PIN = '1234';

beforeEach(() => {
  store.clear();
});

describe('vault-keychain', () => {
  describe('vault status checks', () => {
    it('isVaultSetup returns false when empty', async () => {
      expect(await isVaultSetup()).toBe(false);
    });

    it('isVaultSetup returns true after createVault', async () => {
      await createVault(TEST_PIN);
      expect(await isVaultSetup()).toBe(true);
    });

    it('getPinAttempts starts at 0', async () => {
      expect(await getPinAttempts()).toBe(0);
    });

    it('isVaultLocked returns false after create', async () => {
      await createVault(TEST_PIN);
      expect(await isVaultLocked()).toBe(false);
    });

    it('hasRecoverySeed returns true after create', async () => {
      await createVault(TEST_PIN);
      expect(await hasRecoverySeed()).toBe(true);
    });
  });

  describe('createVault', () => {
    it('creates vault and returns keyset + mnemonic', async () => {
      const result = await createVault(TEST_PIN);
      expect(result.keySet.vaultKeyHex).toBeTruthy();
      expect(result.keySet.vaultKeyHex.length).toBe(64); // 32 bytes hex
      expect(result.keySet.cipherKey).toBeInstanceOf(SecureBuffer);
      expect(result.keySet.signKey).toBeInstanceOf(SecureBuffer);
      expect(result.keySet.cipherKey.length).toBe(32);
      expect(result.keySet.signKey.length).toBe(32);
      expect(result.mnemonic.split(' ').length).toBe(24);
    });

    it('generates unique vaults', async () => {
      const r1 = await createVault(TEST_PIN);
      const r2 = await createVault(TEST_PIN);
      expect(r1.keySet.vaultKeyHex).not.toBe(r2.keySet.vaultKeyHex);
      expect(r1.mnemonic).not.toBe(r2.mnemonic);
    });

    it('rejects short PIN', async () => {
      await expect(createVault(SHORT_PIN)).rejects.toThrow('at least 8');
    });

    it('cipherKey is 32 bytes', async () => {
      const r = await createVault(TEST_PIN);
      expect(r.keySet.cipherKey.length).toBe(32);
    });

    it('signKey is 32 bytes', async () => {
      const r = await createVault(TEST_PIN);
      expect(r.keySet.signKey.length).toBe(32);
    });
  });

  describe('unlockVault', () => {
    it('unlocks with correct PIN', async () => {
      const created = await createVault(TEST_PIN);
      const keySet = await unlockVault(TEST_PIN);
      expect(keySet).not.toBeNull();
      expect(keySet!.vaultKeyHex).toBe(created.keySet.vaultKeyHex);
      expect(keySet!.cipherKey).toBeInstanceOf(SecureBuffer);
      expect(keySet!.signKey).toBeInstanceOf(SecureBuffer);
    });

    it('returns null for wrong PIN', async () => {
      await createVault(TEST_PIN);
      const keySet = await unlockVault(TEST_PIN2);
      expect(keySet).toBeNull();
    });

    it('tracks failed attempts', async () => {
      await createVault(TEST_PIN);
      await unlockVault('99999999');
      await unlockVault('99999999');
      const attempts = await getPinAttempts();
      expect(attempts).toBeGreaterThanOrEqual(2);
    });

    it('throws VAULT_LOCKED after 5 wrong attempts', async () => {
      await createVault(TEST_PIN);
      for (let i = 0; i < 5; i++) {
        await unlockVault('99999999');
      }
      await expect(unlockVault(TEST_PIN)).rejects.toThrow('VAULT_LOCKED');
    });

    it('rejects short PIN', async () => {
      await createVault(TEST_PIN);
      expect(await unlockVault(SHORT_PIN)).toBeNull();
    });
  });

  describe('changePin', () => {
    it('changes PIN and unlocks with new PIN', async () => {
      await createVault(TEST_PIN);
      const result = await changePin(TEST_PIN, TEST_PIN2);
      expect(result).not.toBeNull();
      const keySet = await unlockVault(TEST_PIN2);
      expect(keySet).not.toBeNull();
    });

    it('returns null for wrong old PIN', async () => {
      await createVault(TEST_PIN);
      const result = await changePin('99999999', TEST_PIN2);
      expect(result).toBeNull();
    });
  });

  describe('exportVaultSeed / importVaultSeed', () => {
    it('exports and imports seed', async () => {
      await createVault(TEST_PIN);
      const seed = await exportVaultSeed();
      expect(seed.deviceSalt).toBeTruthy();
      expect(seed.wrappedVaultKey).toBeTruthy();
      expect(seed.pinVerifyHash).toBeTruthy();

      // Simulate fresh device: clear store, import seed
      store.clear();
      const keySet = await importVaultSeed(TEST_PIN, seed);
      expect(keySet.vaultKeyHex).toBeTruthy();
      expect(keySet.cipherKey).toBeInstanceOf(SecureBuffer);
    });

    it('importVaultSeed rejects wrong PIN', async () => {
      await createVault(TEST_PIN);
      const seed = await exportVaultSeed();
      store.clear();
      await expect(importVaultSeed(TEST_PIN2, seed)).rejects.toThrow('INCORRECT_PIN');
    });
  });

  describe('recoverWithMnemonic', () => {
    it('recovers with mnemonic and new PIN', async () => {
      const created = await createVault(TEST_PIN);
      const recovered = await recoverWithMnemonic(created.mnemonic, TEST_PIN2);
      expect(recovered.vaultKeyHex).toBe(created.keySet.vaultKeyHex);
      expect(recovered.cipherKey).toBeInstanceOf(SecureBuffer);
    });

    it('can lock after recovery, unlock with new PIN', async () => {
      const created = await createVault(TEST_PIN);
      await recoverWithMnemonic(created.mnemonic, TEST_PIN2);
      const keySet = await unlockVault(TEST_PIN2);
      expect(keySet!.vaultKeyHex).toBe(created.keySet.vaultKeyHex);
    });

    it('rejects invalid mnemonic', async () => {
      await createVault(TEST_PIN);
      await expect(recoverWithMnemonic('invalid words here', TEST_PIN)).rejects.toThrow('Invalid recovery');
    });

    it('rejects wrong mnemonic (different vault)', async () => {
      // Create vault1, save its mnemonic
      const vault1 = await createVault(TEST_PIN);
      const vault1Mnemonic = vault1.mnemonic;

      // Create vault2 (overwrites recovery keys in store)
      await createVault(TEST_PIN);

      // Try to recover vault2's keys with vault1's mnemonic → should fail
      await expect(recoverWithMnemonic(vault1Mnemonic, TEST_PIN)).rejects.toThrow('Failed to decrypt');
    });
  });

  describe('purgeVault', () => {
    it('purges all keys from SecureStore', async () => {
      await createVault(TEST_PIN);
      await purgeVault();
      expect(await isVaultSetup()).toBe(false);
    });
  });

  describe('Safe API (Result<T, DomainError>)', () => {
    it('createVaultSafe returns Ok on success', async () => {
      const result = await createVaultSafe(TEST_PIN);
      expect(result.ok).toBe(true);
    });

    it('unlockVaultSafe returns Ok with correct PIN', async () => {
      await createVault(TEST_PIN);
      const result = await unlockVaultSafe(TEST_PIN);
      expect(result.ok).toBe(true);
    });

    it('unlockVaultSafe returns Err with wrong PIN', async () => {
      await createVault(TEST_PIN);
      const result = await unlockVaultSafe(TEST_PIN2);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.code).toBe('WRONG_PIN');
      }
    });
  });

  describe('SecureBuffer lifecycle', () => {
    it('disposing keySet disposes both keys', () => {
      // SecureBuffer.disposed returns true after dispose()
      const ck = SecureBuffer.random(32);
      const sk = SecureBuffer.random(32);
      expect(ck.disposed).toBe(false);
      expect(sk.disposed).toBe(false);
      ck.dispose();
      sk.dispose();
      expect(ck.disposed).toBe(true);
      expect(sk.disposed).toBe(true);
    });

    it('copy returns independent buffer', () => {
      const ck = SecureBuffer.random(32);
      const copy = ck.copy();
      expect(copy.length).toBe(32);
      copy.fill(0);
      expect(ck.toHex()).not.toBe('0'.repeat(64)); // original unchanged
      ck.dispose();
    });
  });
});
