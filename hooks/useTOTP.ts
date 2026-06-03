/**
 * useTOTP — real-time TOTP code with countdown
 */
import { useState, useEffect } from 'react';
import { generateTOTP } from '../lib/crypto/totp';

export function useTOTP(secret: string | undefined) {
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setError(false);
    const tick = () => {
      try {
        const r = generateTOTP(secret);
        setCode(r.code);
        setRemaining(r.remainingSeconds);
      } catch {
        setCode(''); setRemaining(0); setError(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [secret]);

  return { code, remaining, error };
}
