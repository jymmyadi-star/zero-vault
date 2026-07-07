import { create } from 'zustand';
import type { VaultKeySet } from '../crypto/vault-keychain';
import type { SecureBuffer } from '../crypto/secure-buffer';

export type VaultStatus = 'loading' | 'locked' | 'setup_required' | 'unlocked';
export type SyncStatus = 'idle' | 'syncing' | 'secured' | 'error' | 'offline';

interface VaultState {
  status: VaultStatus;
  vaultKey: SecureBuffer | null;
  cipherKey: SecureBuffer | null;
  signKey: SecureBuffer | null;
  vaultKeyHex: string | null;
  isOffline: boolean;
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  tempMnemonic: string | null;

  setStatus: (status: VaultStatus) => void;
  setTempMnemonic: (mnemonic: string | null) => void;
  unlock: (keySet: VaultKeySet) => void;
  lock: () => void;
  setIsOffline: (offline: boolean) => void;
  setSyncEnabled: (enabled: boolean) => void;
  setSyncStatus: (syncStatus: SyncStatus) => void;
  setLastSyncAt: (timestamp: number) => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: 'loading',
  vaultKey: null,
  cipherKey: null,
  signKey: null,
  vaultKeyHex: null,
  isOffline: false,
  syncEnabled: false,
  syncStatus: 'idle',
  lastSyncAt: null,
  tempMnemonic: null,

  setStatus: (status) => set({ status }),
  setTempMnemonic: (tempMnemonic) => set({ tempMnemonic }),

  unlock: (keySet) => {
    const state = useVaultStore.getState();
    if (state.vaultKey && state.vaultKey !== keySet.vaultKey) state.vaultKey.dispose();
    if (state.cipherKey && state.cipherKey !== keySet.cipherKey) state.cipherKey.dispose();
    if (state.signKey && state.signKey !== keySet.signKey) state.signKey.dispose();
    
    const hex = keySet.vaultKey.toHex();
    set({
      status: 'unlocked',
      vaultKey: keySet.vaultKey,
      cipherKey: keySet.cipherKey,
      signKey: keySet.signKey,
      vaultKeyHex: hex,
    });
  },

  lock: () => {
    const state = useVaultStore.getState();
    if (state.vaultKey) state.vaultKey.dispose();
    if (state.cipherKey) state.cipherKey.dispose();
    if (state.signKey) state.signKey.dispose();
    set({
      status: 'locked',
      vaultKey: null,
      cipherKey: null,
      signKey: null,
      vaultKeyHex: null,
      syncEnabled: false,
      syncStatus: 'idle',
    });
  },

  setIsOffline: (isOffline) => set({ isOffline }),
  setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
