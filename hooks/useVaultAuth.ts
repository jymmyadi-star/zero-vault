/**
 * useVaultAuth — vault authentication state machine
 * Extracted from unlock.tsx (was 728 lines → now the screen is ~50 lines)
 *
 * Modes: loading | unlock | setup | setup_confirm | locked | mnemonic_show | recover
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Animated } from 'react-native';
import { router } from 'expo-router';
import { useVaultStore } from '../lib/store/vault-store';
import {
  createVault, unlockVault, isVaultSetup, getPinAttempts, isVaultLocked,
  recoverWithMnemonic, hasRecoverySeed,
  type VaultKeySet, type VaultGenesisResult,
} from '../lib/crypto/vault-keychain';
import { kv } from '../lib/storage';
import { Logger } from '../lib/logger';
import { hapticTouch, hapticSuccess, hapticError, hapticWarning } from '../lib/haptics';
import { SecureBuffer } from '../lib/crypto/secure-buffer';

const PIN_LENGTH = 8;
const MAX_PIN = 5;

export type VaultMode =
  | 'loading' | 'unlock' | 'setup' | 'setup_confirm'
  | 'locked' | 'mnemonic_show' | 'recover';

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
      const vk = await SecureStore.getItemAsync('zerovault_biometric_dbkey', { requireAuthentication: true });
      const ck = await SecureStore.getItemAsync('zerovault_biometric_cipherkey', { requireAuthentication: true });
      const sk = await SecureStore.getItemAsync('zerovault_biometric_signkey', { requireAuthentication: true });

      if (vk && ck && sk) {
        const { hexToBytes } = await import('../lib/crypto/crypto-utils');
        const cipherKey = SecureBuffer.from(hexToBytes(ck));
        const signKey = SecureBuffer.from(hexToBytes(sk));
        await hapticSuccess();
        unlockStore({ vaultKeyHex: vk, cipherKey, signKey });
        setStatus('unlocked');
      }
    } catch {
      setError('Biometric unavailable. Enter PIN.');
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
        const bio = kv.get('zerovault_biometric_enabled') === 'true';
        if (bio) triggerBiometricUnlock();
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

    if (mode === 'recover') {
      const newInput = recoveryInput + digit;
      setRecoveryInput(newInput);
      if (newInput.length >= 24) {
        setProcessing(true);
        try {
          const word = newInput;
          const hasSeed = await hasRecoverySeed();
          if (!hasSeed) throw new Error('No recovery seed on this device.');
          if (!pin || pin === '00000000' || pin.length < 8) {
            setError('Please create a PIN (minimum 8 digits) before recovering.');
            setProcessing(false);
            return;
          }
          const keySet = await recoverWithMnemonic(word, pin);
          await hapticSuccess();
          unlockStore(keySet);
          setStatus('unlocked');
        } catch (e: any) {
          setError('Recovery failed: ' + (e.message || 'Unknown'));
          setRecoveryInput('');
          setMode('unlock');
          shake();
          await hapticError();
        } finally {
          setProcessing(false);
        }
      }
      return;
    }

    if (mode === 'setup_confirm') {
      const newPin = confirmPin + digit;
      if (newPin.length >= PIN_LENGTH) {
        setConfirmPin(newPin);
        setProcessing(true);
        try {
          if (newPin !== pin) {
            setError('PIN mismatch.');
            setConfirmPin('');
            shake();
            await hapticError();
            setProcessing(false);
            return;
          }
          const result: VaultGenesisResult = await createVault(newPin);
          await hapticSuccess();
          setGeneratedMnemonic(result.mnemonic);
          unlockStore(result.keySet);
          setMode('mnemonic_show');
        } catch {
          setError('Vault genesis failed.');
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

    if (newPin.length >= PIN_LENGTH) {
      setPin(newPin);
      setProcessing(true);

      if (mode === 'setup') {
        setMode('setup_confirm');
        setProcessing(false);
        return;
      }

      if (mode === 'unlock') {
        try {
          const keySet: VaultKeySet | null = await unlockVault(newPin);
          if (!keySet) {
            throw new Error('Incorrect PIN.');
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
          setError(msg || 'Incorrect PIN.');
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

    if (mode === 'recover') {
      setRecoveryInput(prev => prev.slice(0, -1));
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

  const handleDeleteVault = useCallback(() => {
    Alert.alert('Purge Vault', 'Delete all data and create a new vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Purge', style: 'destructive', onPress: () => {
        import('../lib/crypto/vault-keychain').then(mod => {
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
    checkVaultState, setMode, setPin, setRecoveryInput,
    PIN_LENGTH,
  };
}
