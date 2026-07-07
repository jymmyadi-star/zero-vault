import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { initializeV2Database, getV2Database, type V2Database } from './database-v2';
import { Logger } from '../logger';

const DatabaseV2Context = createContext<V2Database | null>(null);

export function useV2Database(): V2Database {
  const db = useContext(DatabaseV2Context);
  if (!db) throw new Error('useV2Database() must be used inside DatabaseV2Provider');
  return db;
}

export function DatabaseV2Provider({ children, vaultKeyHex }: { children: ReactNode; vaultKeyHex: string }) {
  const [db, setDb] = useState<V2Database | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    initializeV2Database(vaultKeyHex)
      .then((instance) => {
        if (!cancelled) {
          setDb(instance);
          Logger.info('[DatabaseV2Provider] Database ready', { module: 'DatabaseV2Provider' });
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err.message);
          Logger.error('[DatabaseV2Provider] Initialization failed', err, { module: 'DatabaseV2Provider' });
        }
      });
    return () => { cancelled = true; };
  }, [vaultKeyHex]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Database error: {error}</Text>
      </View>
    );
  }

  if (!db) {
    return <View style={styles.splash} />;
  }

  return <DatabaseV2Context.Provider value={db}>{children}</DatabaseV2Context.Provider>;
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  splash: { flex: 1, backgroundColor: '#000000' },
});

export { getV2Database };
