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

  let charset = LOWERCASE;
  if (options.includeUppercase) charset += UPPERCASE;
  if (options.includeDigits) charset += DIGITS;
  if (options.includeSymbols) charset += SYMBOLS;
  if (options.excludeAmbiguous) {
    charset = charset.split('').filter(c => !AMBIGUOUS.includes(c)).join('');
  }

  if (charset.length === 0) {
    throw new Error('Character set is empty — enable at least one character class');
  }

  const array = new Uint32Array(options.length);
  crypto.getRandomValues(array);

  let result = '';
  for (let i = 0; i < options.length; i++) {
    result += charset[array[i]! % charset.length];
  }

  // Ensure at least one of each requested type
  if (options.includeUppercase && !/[A-Z]/.test(result)) {
    result = result.substring(0, result.length - 1) + UPPERCASE[array[0]! % UPPERCASE.length];
  }
  if (options.includeDigits && !/\d/.test(result)) {
    result = result.substring(0, result.length - 2) + DIGITS[array[1]! % DIGITS.length] + result.charAt(result.length - 1);
  }
  if (options.includeSymbols && !/[^a-zA-Z0-9]/.test(result)) {
    result = result.substring(0, result.length - 2) + SYMBOLS[array[2]! % SYMBOLS.length] + result.charAt(result.length - 1);
  }

  return result;
}

/** Generate a memorable passphrase using diceware-style word list */
const WORDLIST = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
  'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
  'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
  'yankee', 'zulu', 'apple', 'stone', 'cloud', 'river', 'storm', 'flame',
  'ocean', 'tiger', 'eagle', 'frost', 'coral', 'amber', 'raven', 'blaze',
  'cedar', 'dune', 'ember', 'forge', 'glade', 'haven', 'ivory', 'jade',
  'koi', 'lotus', 'maple', 'nova', 'onyx', 'pearl', 'quartz', 'ridge',
  'sage', 'thorn', 'umber', 'vale', 'willow', 'zenith', 'aster', 'birch',
];

export function generatePassphrase(wordCount: number = 4, separator: string = '-'): string {
  const words: string[] = [];
  const array = new Uint32Array(wordCount);
  crypto.getRandomValues(array);
  for (let i = 0; i < wordCount; i++) {
    words.push(WORDLIST[array[i]! % WORDLIST.length]!);
  }
  return words.join(separator);
}
