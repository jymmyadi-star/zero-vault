import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncPush, drainBacklog } from '../push';
import * as pullModule from '../pull';
import * as apiClientModule from '../api-client';
import { useVaultStore } from '../../store/vault-store';

vi.mock('../../db', () => {
  const dbWrite = vi.fn(async (cb) => cb());
  
  const mockRecord = {
    id: 'backlog-1',
    sequence: 1,
    recordId: 'item-1',
    operation: 'INSERT',
    payloadCiphertext: '{"envelope":{},"wrappedDek":{}}',
    hlc: '2024-01-01T00:00:00Z',
    update: vi.fn(),
    markAsDeleted: vi.fn(),
  };

  return {
    getDatabase: () => ({
      write: dbWrite,
      get: (table: string) => ({
        query: () => ({
          fetch: () => Promise.resolve(table === 'sync_backlog' ? [mockRecord] : []),
        }),
        find: () => Promise.resolve(mockRecord),
      }),
    }),
  };
});

vi.mock('../../network-status', () => ({
  getIsOnline: () => true,
}));

describe('SyncPush - Drain Backlog Rebase Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useVaultStore.setState({
      syncEnabled: true,
      signKey: { copy: () => new Uint8Array(32) }, // mock SecureBuffer
    } as any);
  });

  it('immediately triggers pull and retries on HASH_CHAIN_CONFLICT', async () => {
    // We mock apiClient.push to fail with HASH_CHAIN_CONFLICT on the first try, then succeed
    const pushSpy = vi.spyOn(apiClientModule.apiClient, 'push')
      .mockRejectedValueOnce(new Error('Server rejected: HASH_CHAIN_CONFLICT'))
      .mockResolvedValueOnce({ accepted: 1, rejected: 0 });
    
    // We mock pullChanges to resolve successfully
    const pullSpy = vi.spyOn(pullModule, 'pullChanges').mockResolvedValue(undefined);

    await drainBacklog();

    // apiClient.push should be called
    expect(pushSpy).toHaveBeenCalled();
    // Because it returned HASH_CHAIN_CONFLICT, pullChanges should be called to rebase
    expect(pullSpy).toHaveBeenCalled();

    // Note: Due to `isDrainPending = true; break;` in the drain loop,
    // drainBacklog calls itself recursively in the `finally` block of `drainBacklog`.
    // Since it's not awaited there, we need to wait for the event loop to tick.
    await vi.waitFor(() => {
      expect(pushSpy).toHaveBeenCalledTimes(2);
    });
  });
});
