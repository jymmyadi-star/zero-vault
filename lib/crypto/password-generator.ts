import { randomBytes } from './crypto-utils';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*-_=+<>';
const AMBIGUOUS = 'iIl1Lo0O';

export interface PasswordOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

function buildCharset(opts: PasswordOptions): string {
  let charset = '';
  if (opts.lowercase) charset += LOWERCASE;
  if (opts.uppercase) charset += UPPERCASE;
  if (opts.digits) charset += DIGITS;
  if (opts.symbols) charset += SYMBOLS;

  if (charset.length === 0) {
    charset = LOWERCASE + UPPERCASE + DIGITS;
  }

  if (opts.excludeAmbiguous) {
    for (const ch of AMBIGUOUS) {
      charset = charset.replace(ch, '');
    }
  }

  return charset;
}

export function generatePassword(options?: Partial<PasswordOptions>): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const charset = buildCharset(opts);

  if (charset.length === 0) {
    throw new Error('No character sets selected for password generation');
  }

  const bytes = randomBytes(opts.length * 2);
  let pwd = '';

  for (let i = 0; i < opts.length; i++) {
    const byte = bytes[i % bytes.length] ?? 0;
    pwd += charset[byte % charset.length]!;
  }

  const requiredSets: { condition: boolean; source: string }[] = [
    { condition: opts.lowercase, source: LOWERCASE },
    { condition: opts.uppercase, source: UPPERCASE },
    { condition: opts.digits, source: DIGITS },
    { condition: opts.symbols, source: SYMBOLS },
  ];

  const missing = requiredSets.filter((s) => s.condition && !hasCharFromSet(pwd, s.source));
  if (missing.length > 0) {
    for (let i = 0; i < missing.length && i < pwd.length; i++) {
      const set = missing[i]!;
      const rnd = bytes[i + opts.length] ?? 0;
      const idx = i % opts.length;
      const replacement = set.source[rnd % set.source.length]!;
      pwd = pwd.substring(0, idx) + replacement + pwd.substring(idx + 1);
    }
  }

  return pwd;
}

function hasCharFromSet(str: string, charset: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (charset.includes(str[i]!)) return true;
  }
  return false;
}

export function calculateEntropy(password: string): number {
  if (!password) return 0;

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += 32;

  if (pool === 0) return 0;
  return Math.min(Math.round(password.length * Math.log2(pool)), 128);
}

export function entropyLabel(entropy: number): 'weak' | 'medium' | 'strong' | 'vault-grade' {
  if (entropy < 40) return 'weak';
  if (entropy < 70) return 'medium';
  if (entropy < 100) return 'strong';
  return 'vault-grade';
}

const DICE_WORDS = [
  'alpha', 'bravo', 'cipher', 'delta', 'echo', 'foxtrot', 'gamma',
  'helix', 'ion', 'juliett', 'kilo', 'lunar', 'matrix', 'nova',
  'omega', 'photon', 'quantum', 'reactor', 'sigma', 'tango',
  'ultra', 'vector', 'whiskey', 'xenon', 'yankee', 'zenith',
  'anchor', 'binary', 'cosmic', 'drift', 'ember', 'frost',
  'ghost', 'horizon', 'index', 'jade', 'kernel', 'lucid',
  'mirage', 'neon', 'onyx', 'prism', 'relay', 'shadow',
  'titan', 'umbra', 'vault', 'warp', 'xray', 'yield', 'zero',
];

export function generatePassphrase(wordCount: number = 6, separator: string = '-'): string {
  const bytes = randomBytes(wordCount * 2);
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const idx = (bytes[i * 2]! << 8 | bytes[i * 2 + 1]!) % DICE_WORDS.length;
    words.push(DICE_WORDS[idx]!);
  }
  return words.join(separator);
}
