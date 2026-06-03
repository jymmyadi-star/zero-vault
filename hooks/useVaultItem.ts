/**
 * useVaultItem — vault item loader with background security clearing
 */
import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { getVaultItemById, type DecryptedVaultItem } from '../lib/services/vault-service';

export function useVaultItem(id: string | undefined) {
  const [item, setItem] = useState<DecryptedVaultItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await getVaultItemById(id);
      data ? setItem(data) : setError('Decryption failed.');
    } catch (e: any) {
      setError(e.message || 'Failed to load.');
    }
  }, [id]);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        setItem(null);
      }
    });
    return () => { sub.remove(); setItem(null); };
  }, [load]);

  const clear = useCallback(() => { setItem(null); }, []);

  return { item, error, reload: load, clear };
}
