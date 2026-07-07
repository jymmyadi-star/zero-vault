import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { type Database as DatabaseType } from '@nozbe/watermelondb';
import { initializeDatabase } from './index';
import { Logger } from '../logger';
import { useVaultStore } from '../store/vault-store';
import { supabase, isSupabaseConfigured } from '../supabase';
import { initSyncState } from '../sync/index';

const DatabaseContext = createContext<DatabaseType | null>(null);

let globalPatched = false;
function suppressWatermelonDBErrors() {
  if (globalPatched) return;
  globalPatched = true;

  try {
    const Result = require('@nozbe/watermelondb/utils/fp/Result');
    const origFromPromise = Result.fromPromise;
    Result.fromPromise = function (promise: Promise<any>, callback?: (result: any) => void) {
      const safeCb = typeof callback === 'function' ? callback : () => {};
      return origFromPromise(promise, safeCb);
    };
  } catch {}

  try {
    const g = global as any;
    const origHandler = g.ErrorUtils?.getGlobalHandler() || (() => {});
    g.ErrorUtils?.setGlobalHandler((error: Error, isFatal?: boolean) => {
      if (typeof error?.message === 'string' && error.message.includes('callback is not a function')) return;
      origHandler(error, isFatal);
    });
  } catch {}
}
export function DatabaseProvider({ children, vaultKeyHex }: { children: ReactNode; vaultKeyHex: string }) {
  const [db, setDb] = useState<DatabaseType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    suppressWatermelonDBErrors();

    initializeDatabase(vaultKeyHex)
      .then((database) => {
        setDb(database);
        Logger.info('[DatabaseProvider] Database ready', { module: 'DatabaseProvider' });

        try {
          initSyncState();
        } catch {}
      })
      .catch((err) => {
        Logger.error('[DatabaseProvider] Init failed', err, { module: 'DatabaseProvider' });
        setError(err.message || 'Database initialization failed');
      });
  }, [vaultKeyHex]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b', padding: 24 }}>
        <Text style={{ color: '#f87171', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Database Error</Text>
        <Text style={{ color: '#a1a1aa', fontSize: 14, textAlign: 'center' }}>{error}</Text>
        <Text style={{ color: '#52525b', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          Use a development build for full functionality.
        </Text>
      </View>
    );
  }

  if (!db) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' }}>
        <ActivityIndicator size="large" color="#a78bfa" />
        <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 16 }}>Decrypting vault...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={db}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseType {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase must be used within DatabaseProvider');
  return db;
}
