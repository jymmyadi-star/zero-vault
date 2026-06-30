import { describe, it, expect, beforeEach, vi } from 'vitest';

let mockStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { mockStore.set(key, value); },
  deleteItemAsync: async (key: string) => { mockStore.delete(key); },
}));

vi.mock('../crypto-utils', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../crypto-utils')>();
  return {
    ...mod,
    deriveWithArgon2: async (password: string, salt: Uint8Array): Promise<Uint8Array> => {
      // Deterministic mock: produce different keys for different passwords
      const key = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        key[i] = (salt[i % salt.length]! ^ password.charCodeAt(i % password.length) ^ 0xAA);
      }
      return key;
    },
  };
});

import {
  createVault,
  unlockVault,
  recoverWithMnemonic,
  changePin,
  purgeVault,
  isVaultSetup,
  hasRecoverySeed,
  exportVaultSeed,
  importVaultSeed,
} from '../vault-keychain';

const PIN = '12345678';
const NEW_PIN = '87654321';

beforeEach(() => {
  mockStore = new Map<string, string>();
});

describe('vault-keychain lifecycle', () => {
  it('createVault generates keys and recovery mnemonic', async () => {
    const result = await createVault(PIN);
    expect(result.mnemonic).toBeTruthy();
    expect(result.mnemonic.split(' ').length).toBe(24);
    expect(result.keySet.vaultKey.toHex()).toBeTruthy();
    expect(result.keySet.vaultKey.toHex().length).toBe(64);
    expect(result.keySet.cipherKey.length).toBe(32);
    expect(result.keySet.signKey.length).toBe(32);

    const setup = await isVaultSetup();
    expect(setup).toBe(true);

    const hasSeed = await hasRecoverySeed();
    expect(hasSeed).toBe(true);
  });

  it('unlockVault returns correct keys after creation', async () => {
    const created = await createVault(PIN);
    const unlocked = await unlockVault(PIN);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.vaultKey.toHex()).toBe(created.keySet.vaultKey.toHex());
  });

  it('unlockVault rejects wrong PIN', async () => {
    await createVault(PIN);
    const result = await unlockVault('00000000');
    expect(result).toBeNull();
  });

  it('createVault rejects short PIN', async () => {
    await expect(createVault('12345')).rejects.toThrow();
  });

  it('recoverWithMnemonic restores vault with new PIN', async () => {
    const { mnemonic, keySet } = await createVault(PIN);
    const recovered = await recoverWithMnemonic(mnemonic, NEW_PIN);

    expect(recovered.vaultKey.toHex()).toBe(keySet.vaultKey.toHex());

    const unlocked = await unlockVault(NEW_PIN);
    expect(unlocked).not.toBeNull();
    expect(unlocked!.vaultKey.toHex()).toBe(keySet.vaultKey.toHex());
  });

  it('old PIN fails after recovery with new PIN', async () => {
    const { mnemonic } = await createVault(PIN);
    await recoverWithMnemonic(mnemonic, NEW_PIN);

    const oldUnlock = await unlockVault(PIN);
    expect(oldUnlock).toBeNull();
  });

  it.skip('changePin updates PIN while preserving keys', async () => {
    const { keySet } = await createVault(PIN);
    const result = await changePin(PIN, NEW_PIN);

    expect(result).not.toBeNull();
    expect(result!.vaultKey.toHex()).toBe(keySet.vaultKey.toHex());

    const newUnlock = await unlockVault(NEW_PIN);
    expect(newUnlock).not.toBeNull();
    expect(newUnlock!.vaultKey.toHex()).toBe(keySet.vaultKey.toHex());
  });

  it('exportVaultSeed and importVaultSeed roundtrip', async () => {
    const { keySet } = await createVault(PIN);
    const seed = await exportVaultSeed();

    expect(seed.deviceSalt).toBeTruthy();
    expect(seed.pinVerifyHash).toBeTruthy();
    expect(seed.wrappedVaultKey).toBeTruthy();

    const imported = await importVaultSeed(PIN, seed);
    expect(imported.vaultKey.toHex()).toBe(keySet.vaultKey.toHex());
  });

  it('purgeVault clears all stored keys', async () => {
    await createVault(PIN);
    await purgeVault();

    const setup = await isVaultSetup();
    expect(setup).toBe(false);

    const hasRecovery = await hasRecoverySeed();
    expect(hasRecovery).toBe(false);
  });
});
