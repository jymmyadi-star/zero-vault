export interface EncryptedEnvelope {
  v: number;
  alg: string;
  iv: string;
  ct: string;
  tag: string;
  aad: string;
}

export interface VaultItem {
  id: string;
  itemType: 'password' | 'seed_phrase' | 'note';
  title: string;
  folder: string | null;
  payloadCiphertext: string;
  favorite: boolean;
  icon: string | null;
  urlHint: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  isPendingDelete: boolean;
}

export interface DecryptedVaultItem {
  id: string;
  itemType: string;
  title: string;
  folder: string | null;
  payload: Record<string, unknown>;
  favorite: boolean;
  icon: string | null;
  urlHint: string | null;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PasswordPayload {
  username?: string;
  password: string;
  url?: string;
  notes?: string;
  totpSecret?: string;
  customFields?: Array<{ label: string; value: string; hidden: boolean }>;
}

export interface SyncLogEntry {
  id: number;
  entity_id: string;
  entity_type: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload_ciphertext: string;
  new_revision: string | null;
  user_id: string;
  key_epoch_id: number;
  hlc: string | null;
}

export interface VaultSeedData {
  deviceSalt: string;
  wrappedVaultKey: string;
  wrappedCipherKey: string;
  wrappedSignKey: string;
  pinVerifyHash: string;
}

export interface PushChange {
  entityId: string;
  entityType: 'vaultItem';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payloadCiphertext: string;
  newRevision: string | null;
  keyEpochId: number;
  hlc: string;
}
