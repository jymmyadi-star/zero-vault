import type { EncryptedEnvelope, WrappedKeySerializable } from '../crypto/crypto-utils';

export type VaultEntityType = 'vaultItem';

export const ENTITY_TO_COLLECTION: Record<VaultEntityType, string> = {
  vaultItem: 'vault_items',
};

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncLogEntry {
  id: number;
  entity_id: string;
  entity_type: string;
  operation: string;
  payload_ciphertext: string;
  new_revision: string | null;
  user_id: string;
  key_epoch_id: number;
  hlc: string | null;
  created_at?: string;
}

export interface HashChainSegment {
  prev_hash: string | null;
  signature: string;
}

export interface DecryptedLogEnvelope {
  envelope: EncryptedEnvelope;
  wrappedDek: WrappedKeySerializable;
  chain: HashChainSegment;
}

export interface PushLogEntry {
  entity_id: string;
  entity_type: string;
  operation: string;
  payload_ciphertext: string;
  new_revision: string | null;
  user_id: string;
  key_epoch_id: number;
  hlc: string;
}
