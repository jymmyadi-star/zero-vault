/**
 * useVaultAuth — vault authentication state machine
 * Extracted from unlock.tsx (was 728 lines → now the screen is ~50 lines)
 *
 * Modes: loading | unlock | setup | setup_confirm | locked | mnemonic_show | recover
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Animated, InteractionManager } from 'react-native';
import { router } from 'expo-router';
import { useVaultStore } from '../lib/store/vault-store';
import {
  createVault, unlockVault, isVaultSetup, getPinAttempts, isVaultLocked,
  recoverWithMnemonic, hasRecoverySeed,
  type VaultKeySet, type VaultGenesisResult,
} from '../lib/crypto/vault-keychain';
import { validateMnemonic } from '../lib/crypto/bip39';
import { kv } from '../lib/storage';
import { Logger } from '../lib/logger';
import { hapticTouch, hapticSuccess, hapticError, hapticWarning } from '../lib/haptics';
import { SecureBuffer } from '../lib/crypto/secure-buffer';

const MIN_PASSWORD_LENGTH = 8;
const MAX_FAILED_ATTEMPTS = 5;

export type VaultMode =
  | 'loading' | 'unlock' | 'setup' | 'setup_confirm'
  | 'locked' | 'mnemonic_show' | 'recover' | 'recover_pin';

export function useVaultAuth() {
  const { setStatus, unlock: unlockStore } = useVaultStore();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [mode, setMode] = useState<VaultMode>('loading');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const shake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const triggerBiometricUnlock = useCallback(async () => {
    try {
      const LocalAuth = require('expo-local-authentication');
      const has = await LocalAuth.hasHardwareAsync();
      const enrolled = await LocalAuth.isEnrolledAsync();
      if (!has || !enrolled) return;

      const SecureStore = require('expo-secure-store');
      const vk = await SecureStore.getItemAsync('zerovault_biometric_dbkey_v3', { requireAuthentication: true });
      const ck = await SecureStore.getItemAsync('zerovault_biometric_cipherkey_v3', { requireAuthentication: true });
      const sk = await SecureStore.getItemAsync('zerovault_biometric_signkey_v3', { requireAuthentication: true });

      if (vk && ck && sk) {
        const { hexToBytes } = await import('../lib/crypto/crypto-utils');
        const vaultKey = SecureBuffer.from(hexToBytes(vk));
        const cipherKey = SecureBuffer.from(hexToBytes(ck));
        const signKey = SecureBuffer.from(hexToBytes(sk));
        await hapticSuccess();
        unlockStore({ vaultKey, cipherKey, signKey });
        setStatus('unlocked');
      }
    } catch {
      setError('Biometric unavailable. Enter password.');
    }
  }, [unlockStore, setStatus]);

  const checkVaultState = useCallback(async () => {
    try {
      const [setup, locked, attempts] = await Promise.all([
        isVaultSetup(), isVaultLocked(), getPinAttempts(),
      ]);
      if (locked) {
        setMode('locked');
      } else if (setup) {
        setMode('unlock');
        const storeStatus = useVaultStore.getState().status;
        const justMounted = storeStatus !== 'locked';
        const bio = kv.get('zerovault_biometric_enabled') === 'true';
        if (bio && !justMounted) triggerBiometricUnlock();
      } else {
        setMode('setup');
      }
    } catch (e) {
      Logger.error('[VaultAuth] State check failed', e, { module: 'VaultAuth' });
      setError('Core system failure.');
    }
  }, [triggerBiometricUnlock]);

  const handleKeyPress = useCallback(async (digit: string) => {
    if (processing) return;
    setError(null);
    await hapticTouch();

    if (mode === 'recover_pin') {
      const newPin = pin + digit;
      if (newPin.length >= MIN_PASSWORD_LENGTH) {
        setPin(newPin);
        setProcessing(true);
        await new Promise<void>(r => InteractionManager.runAfterInteractions(() => r()));

        try {
          const word = recoveryInput.trim().toLowerCase();
          const keySet = await recoverWithMnemonic(word, newPin);
          await hapticSuccess();
          unlockStore(keySet);
          setStatus('unlocked');
        } catch (e: any) {
          setError('Recovery failed: ' + (e?.message || 'Invalid phrase'));
          setPin('');
          setMode('recover');
          shake();
          await hapticError();
        } finally {
          setProcessing(false);
        }
      } else {
        setPin(newPin);
      }
      return;
    }

    if (mode === 'setup_confirm') {
      const newPin = confirmPin + digit;
      if (newPin.length >= MIN_PASSWORD_LENGTH) {
        setConfirmPin(newPin);
        setProcessing(true);
        await new Promise<void>(r => InteractionManager.runAfterInteractions(() => r()));

        try {
          if (newPin !== pin) {
            setError('Password mismatch.');
            setConfirmPin('');
            shake();
            await hapticError();
            setProcessing(false);
            return;
          }
          const result: VaultGenesisResult = await createVault(newPin);
          await hapticSuccess();
          setGeneratedMnemonic(result.mnemonic);
          useVaultStore.getState().setTempMnemonic(result.mnemonic);
          
          // DO NOT setMode('mnemonic_show') here because unlockStore(result.keySet) 
          // will change status to 'unlocked', which instantly unmounts UnlockScreen.
          // Instead, layout.tsx will intercept and redirect to /auth/phrase-intro.
          unlockStore(result.keySet);
        } catch (e: any) {
          setError('Genesis failed: ' + (e?.message || 'Unknown error'));
          console.error('[VaultAuth] Genesis Error:', e);
          setConfirmPin('');
          setPin('');
          setMode('setup');
          shake();
          await hapticError();
        } finally {
          setProcessing(false);
        }
      } else {
        setConfirmPin(newPin);
      }
      return;
    }

    const newPin = (mode === 'setup' ? pin : pin) + digit;

    if (newPin.length >= MIN_PASSWORD_LENGTH) {
      setPin(newPin);
      setProcessing(true);
      await new Promise<void>(r => InteractionManager.runAfterInteractions(() => r()));

      if (mode === 'setup') {
        setMode('setup_confirm');
        setProcessing(false);
        return;
      }

      if (mode === 'unlock') {
        try {
          const keySet: VaultKeySet | null = await unlockVault(newPin);
          if (!keySet) {
            throw new Error('Incorrect password.');
          }
          await hapticSuccess();
          unlockStore(keySet);
          setStatus('unlocked');
          return;
        } catch (e: any) {
          const msg = e.message || '';
          if (msg.includes('VAULT_LOCKED')) {
            setMode('locked');
          }
          setError(msg || 'Incorrect password.');
          setPin('');
          shake();
          await hapticError();
        } finally {
          setProcessing(false);
        }
        return;
      }
    }

    setPin(newPin);
  }, [mode, pin, confirmPin, recoveryInput, processing, setStatus, unlockStore, shake]);

  const handleBackspace = useCallback(async () => {
    if (processing) return;
    setError(null);

    if (mode === 'recover_pin') {
      setPin(prev => prev.slice(0, -1));
      return;
    }
    if (mode === 'setup_confirm') {
      setConfirmPin(prev => prev.slice(0, -1));
      return;
    }
    setPin(prev => prev.slice(0, -1));
  }, [mode, processing]);

  const handleClear = useCallback(() => {
    setPin('');
    setConfirmPin('');
    setError(null);
  }, []);

  const handleSkipRecovery = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  const handleRecoveryInput = useCallback((text: string) => {
    setRecoveryInput(text);
    
    // Auto-advance if the phrase is mathematically valid
    const cleanPhrase = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const wordCount = cleanPhrase.split(' ').length;
    
    // Only attempt validation if we have 12, 15, 18, 21, or 24 words
    if ([12, 15, 18, 21, 24].includes(wordCount)) {
      if (validateMnemonic(cleanPhrase)) {
        setError(null);
        setPin('');
        setMode('recover_pin');
      }
    }
  }, []);

  const handleDeleteVault = useCallback(() => {
    Alert.alert('Purge Vault', 'Delete all data and create a new vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: () => {
        import('../lib/crypto/vault-keychain').then(mod => {
          kv.delete('zerovault_phrase_verified');
          mod.purgeVault();
          setMode('setup');
          setPin('');
        });
      }},
    ]);
  }, []);

  return {
    mode, pin, confirmPin, error, processing,
    generatedMnemonic, recoveryInput,
    shakeAnim, pulseAnim,
    handleKeyPress, handleBackspace, handleClear,
    handleSkipRecovery, handleDeleteVault,
    checkVaultState, setMode, setPin, handleRecoveryInput, setRecoveryInput,
    MIN_PASSWORD_LENGTH,
  };
}
