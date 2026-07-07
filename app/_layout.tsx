import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DatabaseV2Provider } from '../lib/db/database-provider-v2';
import { useVaultStore } from '../lib/store/vault-store';
import { useAutoLock, resetActivityTimer } from '../lib/hooks/useAutoLock';
import { enableAutofillBridge, disableAutofillBridge } from '../lib/autofill-bridge';
import UnlockScreen from './unlock';
import { AmbientBackground } from '../components/AmbientBackground';
import { SentinelGuide } from '../components/SentinelGuide';
import { TurturicaMascot } from '../components/ui/TurturicaMascot';
import { kv } from '../lib/storage';
import '../global.css';

function PrivacyScreen() {
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      setIsActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  if (isActive) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }]}>
      <TurturicaMascot size={80} />
      <Text style={{ color: '#8E8E93', marginTop: 24, fontSize: 12, letterSpacing: 4, fontFamily: 'monospace' }}>SECURE ENCLAVE</Text>
    </View>
  );
}

function NavigationGate() {
  const segments = useSegments();
  const router = useRouter();
  const status = useVaultStore((s) => s.status);

  const isVerified = kv.get('zerovault_phrase_verified') === 'true';
  const isAuth = segments[0] === 'auth';
  const needsRedirect = status === 'unlocked' && !isVerified && !isAuth;

  useEffect(() => {
    if (needsRedirect) {
      setTimeout(() => {
        router.replace('/auth/phrase-intro');
      }, 0);
    }
  }, [needsRedirect]);

  if (needsRedirect) {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', zIndex: 99999 }]} />;
  }

  return null;
}

export default function RootLayout() {
  const status = useVaultStore((s) => s.status);
  const vaultKeyHex = useVaultStore((s) => s.vaultKeyHex);

  useAutoLock();

  useEffect(() => {
    if (vaultKeyHex) {
      enableAutofillBridge(vaultKeyHex);
    } else {
      disableAutofillBridge();
    }
  }, [vaultKeyHex]);

  const transparentContent = { contentStyle: { backgroundColor: 'transparent' } };

  if (status === 'loading' || status === 'locked' || status === 'setup_required') {
    return (
      <ThemeProvider value={DarkTheme}>
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
          <AmbientBackground />
          <StatusBar style="light" />
          <UnlockScreen />
          <PrivacyScreen />
        </View>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <View style={{ flex: 1, backgroundColor: '#000000' }} onTouchStart={resetActivityTimer}>
        <DatabaseV2Provider vaultKeyHex={vaultKeyHex!}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={transparentContent} />
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
          <NavigationGate />
          <PrivacyScreen />
          <SentinelGuide />
        </DatabaseV2Provider>
      </View>
    </ThemeProvider>
  );
}
