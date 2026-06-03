import stringify from 'fast-json-stable-stringify';
import { computeSyncSignature } from '../crypto/crypto-utils';
import type { SyncLogEntry, HashChainSegment } from './types';

interface PayloadDataForChain {
  chain?: HashChainSegment;
  [key: string]: unknown;
}

export async function verifyHashChain(
  log: SyncLogEntry,
  expectedPrevHash: string | null,
  signKey: Uint8Array,
): Promise<boolean> {
  const payloadData: PayloadDataForChain = JSON.parse(log.payload_ciphertext);
  const { chain, ...rawPayload } = payloadData;
  const payloadText = stringify(rawPayload);

  const prevHash = chain?.prev_hash ?? null;
  const signature = chain?.signature;

  if (expectedPrevHash !== null && prevHash !== expectedPrevHash) {
    throw new Error(`HASH_CHAIN_BROKEN: Expected ${expectedPrevHash}, got ${prevHash}`);
  }

  if (signature) {
    const expectedSig = computeSyncSignature(payloadText, prevHash, signKey);

    if (expectedSig.length !== signature.length) {
      throw new Error('HASH_CHAIN_BROKEN: Invalid signature length');
    }

    let mismatch = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      mismatch |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    if (mismatch !== 0) {
      throw new Error('HASH_CHAIN_BROKEN: HMAC signature verification failed');
    }
  } else {
    throw new Error('HASH_CHAIN_BROKEN: Missing signature in log entry');
  }

  return true;
}
