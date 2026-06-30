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
  isOffline: boolean;
  syncEnabled: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: number | null;

  setStatus: (status: VaultStatus) => void;
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
  isOffline: false,
  syncEnabled: false,
  syncStatus: 'idle',
  lastSyncAt: null,

  setStatus: (status) => set({ status }),

  unlock: (keySet) => {
    set({
      status: 'unlocked',
      vaultKey: keySet.vaultKey,
      cipherKey: keySet.cipherKey,
      signKey: keySet.signKey,
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
      syncEnabled: false,
      syncStatus: 'idle',
    });
  },

  setIsOffline: (isOffline) => set({ isOffline }),
  setSyncEnabled: (syncEnabled) => set({ syncEnabled }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
