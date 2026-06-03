import { describe, it, expect } from 'vitest';
import { verifyHashChain } from '../hash-chain';
import { computeSyncSignature, randomBytes, bytesToHex } from '../../crypto/crypto-utils';
import type { SyncLogEntry } from '../types';

function makeLog(payloadCiphertext: string, id = 1): SyncLogEntry {
  return {
    id,
    entity_id: `entity-${id}`,
    entity_type: 'vaultItem',
    operation: 'INSERT',
    payload_ciphertext: payloadCiphertext,
    new_revision: null,
    user_id: 'user-1',
    key_epoch_id: 0,
    hlc: new Date().toISOString(),
  };
}

describe('verifyHashChain', () => {
  const signKey = randomBytes(32);

  it('accepts first log entry (genesis)', async () => {
    const payload = { envelope: {}, wrappedDek: {} };
    const payloadText = JSON.stringify(payload);
    const signature = computeSyncSignature(payloadText, null, signKey);

    const ciphertext = JSON.stringify({
      ...payload,
      chain: { prev_hash: null, signature },
    });

    await expect(verifyHashChain(makeLog(ciphertext), null, signKey)).resolves.toBe(true);
  });

  it('accepts chained log entries', async () => {
    const payload1 = { envelope: { id: 1 }, wrappedDek: {} };
    const payloadText1 = JSON.stringify(payload1);
    const sig1 = computeSyncSignature(payloadText1, null, signKey);

    const payload2 = { envelope: { id: 2 }, wrappedDek: {} };
    const payloadWithoutChain2 = { ...payload2 };
    const payloadText2 = JSON.stringify(payloadWithoutChain2);
    const sig2 = computeSyncSignature(payloadText2, sig1, signKey);

    const ciphertext2 = JSON.stringify({
      ...payload2,
      chain: { prev_hash: sig1, signature: sig2 },
    });

    await expect(verifyHashChain(makeLog(ciphertext2), sig1, signKey)).resolves.toBe(true);
  });

  it('rejects broken chain', async () => {
    const payload = { envelope: {}, wrappedDek: {} };
    const payloadText = JSON.stringify(payload);
    const signature = computeSyncSignature(payloadText, null, signKey);

    const ciphertext = JSON.stringify({
      ...payload,
      chain: { prev_hash: 'wrong_hash_00000000000000000000000000000000', signature },
    });

    await expect(verifyHashChain(makeLog(ciphertext), 'expected_hash_0000000000000000000000000000', signKey)).rejects.toThrow('HASH_CHAIN_BROKEN');
  });

  it('rejects invalid signature', async () => {
    const payload = { envelope: {}, wrappedDek: {} };
    const ciphertext = JSON.stringify({
      ...payload,
      chain: { prev_hash: null, signature: 'bad_sig_000000000000' },
    });

    await expect(verifyHashChain(makeLog(ciphertext), null, signKey)).rejects.toThrow('HASH_CHAIN_BROKEN');
  });

  it('rejects missing chain', async () => {
    const ciphertext = JSON.stringify({ envelope: {}, wrappedDek: {} });
    await expect(verifyHashChain(makeLog(ciphertext), null, signKey)).rejects.toThrow('HASH_CHAIN_BROKEN');
  });

  it('different signKey fails verification', async () => {
    const otherKey = randomBytes(32);
    const payload = { envelope: {}, wrappedDek: {} };
    const payloadText = JSON.stringify(payload);
    const signature = computeSyncSignature(payloadText, null, signKey);

    const ciphertext = JSON.stringify({
      ...payload,
      chain: { prev_hash: null, signature },
    });

    await expect(verifyHashChain(makeLog(ciphertext), null, otherKey)).rejects.toThrow('HASH_CHAIN_BROKEN');
  });
});
