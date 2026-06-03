/**
 * Custom password strength estimator (zxcvbn-like logic, zero dependencies)
 * Uses entropy-based scoring: length, character variety, common patterns
 */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface StrengthResult {
  score: StrengthLevel;
  label: string;
  color: string;
  feedback: string;
  crackTimeDisplay: string;
  percent: number;
}

const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey',
  '1234567', 'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou',
  'master', 'sunshine', 'ashley', 'bailey', 'shadow', '123123',
  '654321', 'superman', 'qazwsx', 'michael', 'football', 'admin',
  'parola', '123456789', 'parola123', 'qwerty123', 'password123',
]);

const KEYBOARD_WALKS = /(?:qwerty|asdfgh|zxcvbn|qwertyuiop|asdfghjkl|zxcvbnm|1234567890|0987654321)/i;
const REPEATED_CHARS = /(.)\1{2,}/;
const SEQUENTIAL = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|890)/i;

export function estimatePasswordStrength(password: string): StrengthResult {
  if (!password || password.length === 0) {
    return { score: 0, label: 'None', color: '#E5E7EB', feedback: 'Enter a password', crackTimeDisplay: 'Instant', percent: 0 };
  }

  let entropy = 0;

  // Length bonus (exponential contribution)
  entropy += password.length * 4;

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  const charsetSize = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSymbol ? 33 : 0);
  if (charsetSize > 0) {
    entropy += Math.log2(charsetSize) * password.length;
  }

  // Penalties
  if (COMMON_PASSWORDS.has(password.toLowerCase())) entropy -= 30;
  if (KEYBOARD_WALKS.test(password)) entropy -= 20;
  if (REPEATED_CHARS.test(password)) entropy -= 15;
  if (SEQUENTIAL.test(password.toLowerCase())) entropy -= 12;
  if (/^[0-9]+$/.test(password)) entropy -= 20; // numbers only
  if (/^[a-z]+$/.test(password)) entropy -= 15; // lowercase only
  if (password.length < 8) entropy -= 10;

  entropy = Math.max(0, Math.min(entropy, 128));

  // Score mapping
  let score: StrengthLevel;
  let label: string;
  let color: string;
  let feedback: string;
  let crackTimeDisplay: string;

  if (entropy < 30) {
    score = 0;
    label = 'Very Weak';
    color = '#EF4444';
    feedback = 'Too easy to guess. Add more characters.';
    crackTimeDisplay = 'Instant';
  } else if (entropy < 45) {
    score = 1;
    label = 'Weak';
    color = '#F59E0B';
    feedback = 'Add uppercase, numbers, and symbols.';
    crackTimeDisplay = 'Seconds';
  } else if (entropy < 60) {
    score = 2;
    label = 'Fair';
    color = '#FBBF24';
    feedback = 'Getting better. Make it longer.';
    crackTimeDisplay = 'Hours';
  } else if (entropy < 80) {
    score = 3;
    label = 'Strong';
    color = '#34D399';
    feedback = 'Good password!';
    crackTimeDisplay = 'Years';
  } else {
    score = 4;
    label = 'Very Strong';
    color = '#10B981';
    feedback = 'Excellent! Very secure.';
    crackTimeDisplay = 'Centuries';
  }

  return {
    score,
    label,
    color,
    feedback,
    crackTimeDisplay,
    percent: Math.min(Math.round((entropy / 100) * 100), 100),
  };
}
