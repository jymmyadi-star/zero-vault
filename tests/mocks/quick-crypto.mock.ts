// Mock for react-native-quick-crypto in Node test environment
// Uses Node's built-in crypto for PBKDF2
import crypto from 'crypto';

export function pbkdf2(
  password: string,
  salt: string,
  iterations: number,
  keylen: number,
  digest: string,
  callback: (err: Error | null, derivedKey?: Buffer) => void,
): void {
  crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
    if (err) callback(err);
    else callback(null, Buffer.isBuffer(derivedKey) ? derivedKey : Buffer.from(derivedKey));
  });
}

export default { pbkdf2 };
