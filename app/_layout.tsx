import React, { useEffect, useState } from 'react';
import { View, Text, TouchableWithoutFeedback } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseProvider } from '../lib/db/database-provider';
import { useVaultStore } from '../lib/store/vault-store';
import { useAutoLock, resetActivityTimer } from '../lib/hooks/useAutoLock';
import { enableAutofillBridge, disableAutofillBridge } from '../lib/autofill-bridge';
import UnlockScreen from './unlock';
import '../global.css';


function VaultGate({ children }: { children: React.ReactNode }) {
  const { status } = useVaultStore();

  if (status === 'loading' || status === 'locked' || status === 'setup_required') {
    return <UnlockScreen />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const { status, cipherKey } = useVaultStore();
  const [vaultKeyHex, setVaultKeyHex] = useState<string | null>(null);

  useAutoLock();

  useEffect(() => {
    const storedKey = (globalThis as any).__zerovault_vaultKeyHex;
    if (storedKey) {
      setVaultKeyHex(storedKey);
      enableAutofillBridge(storedKey);
    } else {
      disableAutofillBridge();
    }
  }, [status]);

  useEffect(() => {
    const origUnlock = useVaultStore.getState().unlock;
    useVaultStore.setState({
      unlock: (keySet) => {
        (globalThis as any).__zerovault_vaultKeyHex = keySet.vaultKeyHex;
        setVaultKeyHex(keySet.vaultKeyHex);
        origUnlock(keySet);
      },
    });
  }, []);

  if (status === 'unlocked' && vaultKeyHex) {
    return (
      <TouchableWithoutFeedback onPress={resetActivityTimer} accessible={false}>
        <View style={{ flex: 1 }}>
          <DatabaseProvider vaultKeyHex={vaultKeyHex}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="create-password" />
              <Stack.Screen name="create-seed" />
              <Stack.Screen name="create-note" />
              <Stack.Screen name="change-pin" />
              <Stack.Screen name="item/[id]" />
              <Stack.Screen name="terms" />
              <Stack.Screen name="privacy-policy" />
              <Stack.Screen name="age-verification" />
              <Stack.Screen name="cookie-consent" />
              <Stack.Screen name="compliance" />
              <Stack.Screen name="import-vault" />
            </Stack>
          </DatabaseProvider>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#09090b' }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="unlock" />
        <Stack.Screen name="auth" />
      </Stack>
    </View>
  );
}
