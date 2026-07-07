import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVaultItem } from '../vault-service';
import { useVaultStore } from '../../store/vault-store';

// Mock DB to capture what is actually being written
const mockCreate = vi.fn();
const mockWrite = vi.fn(async (cb) => cb());

vi.mock('../../db', () => ({
  getDatabase: () => ({
    write: mockWrite,
    get: (table: string) => {
      if (table === 'vault_items') {
        return {
          create: (cb: (m: any) => void) => {
            const m = { _raw: {} };
            cb(m);
            mockCreate(m);
          },
        };
      }
      return { create: vi.fn() };
    },
  }),
}));

// Mock sync to avoid triggering network logic in tests
vi.mock('../../sync/index', () => ({
  onVaultItemChanged: async () => {},
}));

import { SecureBuffer } from '../../crypto/secure-buffer';

describe('OWASP MSTG-STORAGE-1: Data at Rest Encryption', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useVaultStore.setState({
      cipherKey: SecureBuffer.random(32), // Use static method instead of private constructor
      status: 'unlocked',
    } as any);
  });

  it('never writes plaintext payloads to the database', async () => {
    const sensitivePayload = { username: 'testuser', password: 'SuperSecretPassword123!' };
    
    await createVaultItem('password', 'My Bank', sensitivePayload);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const dbRecord = mockCreate.mock.calls[0]?.[0];
    
    expect(dbRecord).toBeDefined();

    // Verify MSTG-STORAGE-1 constraints
    // 1. The plaintext 'password' MUST NOT exist in the record.
    const recordString = JSON.stringify(dbRecord);
    expect(recordString).not.toContain('SuperSecretPassword123!');
    expect(recordString).not.toContain('testuser');

    // 2. The payload MUST be stored as a ciphertext string.
    expect(dbRecord).toHaveProperty('payloadCiphertext');
    expect(typeof dbRecord?.payloadCiphertext).toBe('string');
    
    // 3. Ensure it's a valid JSON envelope format from crypto-utils
    const envelope = JSON.parse(dbRecord?.payloadCiphertext || '{}');
    expect(envelope).toHaveProperty('iv');
    expect(envelope).toHaveProperty('ct');
    expect(envelope).toHaveProperty('tag');
  });

  it('rejects unencrypted creation if Vault is locked (Fail-Safe)', async () => {
    useVaultStore.setState({ cipherKey: null, status: 'locked' } as any);
    
    const sensitivePayload = { content: 'Top secret diary' };
    
    await expect(
      createVaultItem('note', 'Diary', sensitivePayload)
    ).rejects.toThrow('VAULT_LOCKED');
    
    // DB must not be written to if encryption fails
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
