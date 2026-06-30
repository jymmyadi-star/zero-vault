import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useVaultAuth } from '../hooks/useVaultAuth';

const { width, height } = Dimensions.get('window');

function PinDots({ length, max, isError }: { length: number; max: number; isError: boolean }) {
  return (
    <View style={styles.pinDots}>
      {Array.from({ length: max }).map((_, i) => (
        <View key={i} style={[styles.pinDot, i < length ? (isError ? styles.pinDotError : styles.pinDotFilled) : styles.pinDotEmpty]}>
          {i < length && <LinearGradient colors={isError ? ['#FF3B30', '#FF453A'] : ['#00F0FF', '#0072FF']} style={StyleSheet.absoluteFillObject} />}
        </View>
      ))}
    </View>
  );
}

const PIN_LAYOUT = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','âŒ«']];

export default function UnlockScreen() {
  const auth = useVaultAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); auth.checkVaultState(); }, []);

  if (auth.mode === 'loading') {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>INITIALIZING ENCLAVE...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.ambientGlow} />

      <Animated.View style={[styles.inner, { transform: [{ translateX: auth.shakeAnim }] }]}>
        <View style={styles.iconRing}>
          <Ionicons name="lock-closed-outline" size={32} color="#00F0FF" />
        </View>

        <Text style={styles.title}>
          {auth.mode === 'setup' ? 'CREATE MASTER PASSWORD' :
           auth.mode === 'setup_confirm' ? 'CONFIRM MASTER PASSWORD' :
           auth.mode === 'locked' ? 'VAULT LOCKED' :
           auth.mode === 'mnemonic_show' ? 'RECOVERY SEED' :
           auth.mode === 'recover' ? 'ENTER RECOVERY PHRASE' :
           'ENTER MASTER PASSWORD'}
        </Text>

        {auth.mode === 'locked' ? (
          <Text style={styles.lockedText}>Too many failed attempts. Vault is locked for security.</Text>
        ) : auth.mode === 'mnemonic_show' ? (
          <View style={styles.mnemonicBox}>
            <Text style={styles.mnemonicText}>{auth.generatedMnemonic}</Text>
            <Text style={styles.mnemonicWarning}>Write these 24 words on paper. Never share them. This is the ONLY way to recover your vault.</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={auth.handleSkipRecovery}>
              <LinearGradient colors={['#00F0FF', '#0072FF']} style={styles.actionGradient}>
                <Text style={styles.actionBtnText}>ENTER VAULT</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <PinDots
              length={auth.mode === 'setup_confirm' ? auth.confirmPin.length : auth.pin.length}
              max={auth.MIN_PASSWORD_LENGTH}
              isError={!!auth.error}
            />

            {auth.error ? <Text style={styles.errorText}>{auth.error}</Text> : null}
            {auth.mode === 'setup_confirm' ? <Text style={styles.hint}>Re-enter your password to confirm</Text> : null}
            {auth.mode === 'unlock' && auth.pin.length === 0 ? (
              <TouchableOpacity onPress={() => auth.setMode('recover')}>
                <Text style={styles.forgotLink}>Forgot Password? Recover with seed phrase</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.pinGrid}>
              {PIN_LAYOUT.map((row, ri) => (
                <View key={ri} style={styles.pinRow}>
                  {row.map((digit, ci) => (
                    <TouchableOpacity
                      key={ci}
                      style={styles.pinKey}
                      onPress={() => digit === 'âŒ«' ? auth.handleBackspace() : digit ? auth.handleKeyPress(digit) : null}
                      disabled={auth.processing || !digit}
                      activeOpacity={0.6}
                    >
                      {digit === 'âŒ«' ? (
                        <Ionicons name="backspace-outline" size={22} color="#8E8E93" />
                      ) : digit ? (
                        <Text style={styles.pinKeyText}>{digit}</Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {auth.pin.length > 0 && (
              <TouchableOpacity onPress={auth.handleClear} style={styles.clearBtn}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>

      {auth.mode === 'locked' && (
        <TouchableOpacity style={styles.deleteBtn} onPress={auth.handleDeleteVault}>
          <Text style={styles.deleteBtnText}>DELETE VAULT & RESET</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  ambientGlow: { position: 'absolute', top: -height * 0.2, right: -width * 0.3, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, backgroundColor: 'rgba(0,240,255,0.01)' },
  inner: { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
  iconRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1, marginBottom: 30, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statusText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b', letterSpacing: 2 },
  pinDots: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  pinDot: { width: 16, height: 16, borderRadius: 8, overflow: 'hidden' },
  pinDotEmpty: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  pinDotFilled: { borderWidth: 0 },
  pinDotError: { borderWidth: 0 },
  errorText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF3B30', marginBottom: 12 },
  hint: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#555555', marginBottom: 12 },
  forgotLink: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#00F0FF', marginBottom: 16 },
  pinGrid: { gap: 10, marginBottom: 8 },
  pinRow: { flexDirection: 'row', gap: 10 },
  pinKey: { width: 64, height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center' },
  pinKeyText: { fontSize: 22, fontWeight: '600', color: '#FFFFFF' },
  clearBtn: { paddingVertical: 8 },
  clearText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF3B30' },
  mnemonicBox: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,240,255,0.08)', padding: 16, width: '100%' },
  mnemonicText: { fontSize: 12, color: '#00F0FF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 22, marginBottom: 16, textAlign: 'center' },
  mnemonicWarning: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF3B30', textAlign: 'center', marginBottom: 16 },
  actionBtn: { borderRadius: 12, overflow: 'hidden' },
  actionGradient: { paddingVertical: 14, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#020204', letterSpacing: 1 },
  lockedText: { fontSize: 12, color: '#8E8E93', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  deleteBtn: { position: 'absolute', bottom: 60, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', paddingVertical: 14, paddingHorizontal: 24 },
  deleteBtnText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#FF3B30', letterSpacing: 1 },
});
