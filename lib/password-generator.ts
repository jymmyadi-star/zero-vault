/**
 * Secure password generator with customizable rules
 */

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export interface GeneratorOptions {
  length: number;
  includeUppercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
  excludeAmbiguous: boolean; // Remove i,l,1,L,o,0,O
}

const AMBIGUOUS = 'il1Lo0O';

export function generatePassword(options: GeneratorOptions): string {
  if (options.length < 4) throw new Error('Password length must be at least 4');
  if (options.length > 128) throw new Error('Password length must not exceed 128');

  const enabledClasses: string[] = ['lowercase'];
  let charset = LOWERCASE;
  if (options.includeUppercase) { charset += UPPERCASE; enabledClasses.push('uppercase'); }
  if (options.includeDigits) { charset += DIGITS; enabledClasses.push('digits'); }
  if (options.includeSymbols) { charset += SYMBOLS; enabledClasses.push('symbols'); }

  if (options.excludeAmbiguous) {
    charset = charset.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
  }

  if (charset.length === 0) {
    throw new Error('INVALID_CHARSET_CONFIG: Character set is empty — enable at least one character class');
  }

  if (charset.length < 4) {
    throw new Error('INVALID_CHARSET_CONFIG: Character set too small after ambiguous exclusion. Disable excludeAmbiguous or enable more character classes.');
  }

  if (options.includeUppercase && !/[A-Z]/.test(charset)) {
    throw new Error('INVALID_CHARSET_CONFIG: Uppercase requested but all uppercase characters were excluded by ambiguous filter. Disable excludeAmbiguous.');
  }
  if (options.includeDigits && !/[0-9]/.test(charset)) {
    throw new Error('INVALID_CHARSET_CONFIG: Digits requested but all digit characters were excluded by ambiguous filter. Disable excludeAmbiguous.');
  }
  if (options.includeSymbols && !/[^a-zA-Z0-9]/.test(charset)) {
    throw new Error('INVALID_CHARSET_CONFIG: Symbols requested but all symbol characters were excluded by ambiguous filter. Disable excludeAmbiguous.');
  }

  const array = new Uint32Array(options.length);
  crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < options.length; i++) {
    result += charset[array[i]! % charset.length];
  }

  if (options.includeUppercase && !/[A-Z]/.test(result)) {
    const upperOnly = UPPERCASE.split('').filter(c => !AMBIGUOUS.includes(c)).join('') || UPPERCASE;
    result = result.substring(0, result.length - 1) + upperOnly[array[0]! % upperOnly.length];
  }
  if (options.includeDigits && !/\d/.test(result)) {
    const digitsOnly = DIGITS.split('').filter(c => !AMBIGUOUS.includes(c)).join('') || DIGITS;
    result = result.substring(0, result.length - 2) + digitsOnly[array[1]! % digitsOnly.length] + result.charAt(result.length - 1);
  }
  if (options.includeSymbols && !/[^a-zA-Z0-9]/.test(result)) {
    const symOnly = SYMBOLS.split('').filter(c => !AMBIGUOUS.includes(c)).join('') || SYMBOLS;
    result = result.substring(0, result.length - 2) + symOnly[array[2]! % symOnly.length] + result.charAt(result.length - 1);
  }

  return result;
}

/** Generate a memorable passphrase using the EFF Diceware Large wordlist (7776 words, ~12.92 bits/word).
 *  6 words = ~77.5 bits of entropy. Industry standard for secure memorable passphrases. */
import { EFF_WORDLIST } from './eff-wordlist';

const WORD_COUNT = EFF_WORDLIST.length;
const REJECTION_THRESHOLD = Math.floor(Math.pow(2, 16) / WORD_COUNT) * WORD_COUNT;

export interface PassphraseOptions {
  wordCount?: number;
  separator?: string;
  capitalize?: boolean;
  includeNumber?: boolean;
}

export function generatePassphrase(options: PassphraseOptions | number = {}): string {
  const opts: PassphraseOptions = typeof options === 'number' ? { wordCount: options } : options;
  const wordCount = Math.max(4, Math.min(opts.wordCount || 6, 20));
  const separator = opts.separator || '-';
  const capitalize = opts.capitalize ?? true;
  const includeNumber = opts.includeNumber ?? true;

  const words = Array.from({ length: wordCount }, () => {
    const single = new Uint16Array(1);
    let val: number;
    do {
      crypto.getRandomValues(single);
      val = single[0]!;
    } while (val >= REJECTION_THRESHOLD);
    const idx = val % WORD_COUNT;
    const word = EFF_WORDLIST[idx]!;
    return capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });

  let passphrase = words.join(separator);
  if (includeNumber) passphrase += separator + Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return passphrase;
}
