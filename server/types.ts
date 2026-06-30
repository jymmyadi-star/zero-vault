export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncLogRow {
  id: number;
  entity_id: string;
  entity_type: string;
  operation: SyncOperation;
  payload_ciphertext: string;
  new_revision: string | null;
  user_id: string;
  key_epoch_id: number;
  hlc: string | null;
  created_at: string;
}

export interface VaultSeedRow {
  user_id: string;
  device_salt: string;
  wrapped_vault_key: string;
  wrapped_cipher_key: string;
  wrapped_sign_key: string;
  pin_verify_hash: string;
  updated_at: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

export interface PushSyncInput {
  changes: Array<{
    entityId: string;
    entityType: string;
    operation: SyncOperation;
    payloadCiphertext: string;
    newRevision: string | null;
    keyEpochId: number;
    hlc: string;
  }>;
}

export interface PushSyncOutput {
  accepted: number;
  rejected: number;
}

export interface PullSyncInput {
  sinceId: number;
  pageSize?: number;
}

export interface PullSyncOutput {
  logs: SyncLogRow[];
  hasMore: boolean;
  lastId: number;
}

export interface VaultSeedInput {
  deviceSalt: string;
  wrappedVaultKey: string;
  wrappedCipherKey: string;
  wrappedSignKey: string;
  pinVerifyHash: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
}

export const API_ERRORS = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Valid authentication required', statusCode: 401 },
  FORBIDDEN: { code: 'FORBIDDEN', message: 'Insufficient permissions', statusCode: 403 },
  NOT_FOUND: { code: 'NOT_FOUND', message: 'Resource not found', statusCode: 404 },
  RATE_LIMITED: { code: 'RATE_LIMITED', message: 'Too many requests', statusCode: 429 },
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', message: 'Invalid input', statusCode: 400 },
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
  SUPABASE_ERROR: { code: 'SUPABASE_ERROR', message: 'Database operation failed', statusCode: 502 },
  SYNC_CONFLICT: { code: 'SYNC_CONFLICT', message: 'Sync conflict detected', statusCode: 409 },
} as const;
