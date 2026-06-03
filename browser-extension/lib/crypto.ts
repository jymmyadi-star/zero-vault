import { Buffer } from 'buffer';
import type { EncryptedEnvelope } from './types';

export {
  bytesToHex,
  hexToBytes,
  randomBytes,
  generateRandomKey,
  wrapKey,
  unwrapKey,
  encryptPayload,
  decryptPayload,
  deriveWithPBKDF2 as deriveKey,
  deriveWithHKDF as deriveHkdfKey,
  mnemonicToSeed,
  computeSignature,
  timingSafeCompare,
  type WrappedKey,
  type EncryptedEnvelope,
} from '../../lib/crypto/shared-primitives';

const WORDS = [
  'alpha', 'bravo', 'cipher', 'delta', 'echo', 'foxtrot', 'gamma', 'helix', 'ion',
  'juliett', 'kilo', 'lunar', 'matrix', 'nova', 'omega', 'photon', 'quantum',
  'reactor', 'sigma', 'tango', 'ultra', 'vector', 'whiskey', 'xenon', 'yankee',
  'zenith', 'anchor', 'binary', 'cosmic', 'drift', 'ember', 'frost', 'ghost',
  'horizon', 'index', 'jade', 'kernel', 'lucid', 'mirage', 'neon', 'onyx',
  'prism', 'relay', 'shadow', 'titan', 'umbra', 'vault', 'warp', 'xray', 'yield',
  'zero', 'byte', 'cache', 'debug', 'epoch', 'fiber', 'grid', 'hash', 'input',
  'laser', 'modem', 'nexus', 'optic', 'patch', 'query', 'route', 'stack',
  'token', 'usb', 'vpn', 'web', 'xml', 'yaml', 'zip', 'async', 'block', 'chip',
  'data', 'ebpf', 'flag', 'giga', 'host', 'ipfs', 'json', 'k8s', 'loop',
  'meta', 'node', 'ops', 'ping', 'port', 'raid', 'sql', 'time', 'unit', 'var',
  'wasm', 'x509', 'yara', 'zlib', 'array', 'bool', 'char', 'disk', 'enum',
  'func', 'heap', 'iptc', 'join', 'keep', 'lock', 'malloc', 'none', 'open',
  'pipe', 'rpc', 'spawn', 'test', 'user', 'void',
];

import { randomBytes } from '../../lib/crypto/shared-primitives';

export function generateMnemonic(): string {
  const words: string[] = [];
  for (let i = 0; i < 24; i++) {
    const idx = randomBytes(1)[0]! % WORDS.length;
    words.push(WORDS[idx]!);
  }
  return words.join(' ');
}
