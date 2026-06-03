import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Alert, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputPod } from '../components';
import { changePin, unlockVault } from '../lib/crypto/vault-keychain';
import { useVaultStore } from '../lib/store/vault-store';

import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function ChangePinScreen() {
  const insets = useSafeAreaInsets();
  const { unlock: unlockStore } = useVaultStore();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'verify' | 'change'>('verify');
  
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [step]);

  const handleVerify = async () => {
    if (!currentPin || currentPin.length < 8) {
      hapticWarning();
      Alert.alert('Invalid PIN', 'Please enter your current Master PIN (minimum 8 digits).');
      return;
    }
    setIsLoading(true);
    try {
      const keySet = await unlockVault(currentPin);
      if (keySet) {
        await hapticSuccess();
        fadeAnim.setValue(0);
        setStep('change');
      } else {
        hapticWarning();
        Alert.alert('Incorrect PIN', 'The Master PIN entered does not match system logs.');
      }
    } catch (e: any) {
      Alert.alert('Authentication Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = async () => {
    if (!newPin || newPin.length < 8) {
      hapticWarning();
      Alert.alert('Invalid PIN', 'New Master PIN must be at least 8 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      hapticWarning();
      Alert.alert('Mismatch', 'The confirmation PIN does not match.');
      return;
    }
    if (newPin === currentPin) {
      hapticWarning();
      Alert.alert('No Change', 'New PIN must be different from your current PIN.');
      return;
    }

    setIsLoading(true);
    try {
      const keySet = await changePin(currentPin, newPin);
      if (keySet) {
        await hapticSuccess();
        unlockStore(keySet);
        Alert.alert('PIN Updated', 'Your cryptographic Master PIN has been updated successfully.', [
          { text: 'Acknowledge', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Failed', 'System could not update Master PIN.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'PIN alteration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />

      {/* Cyber Grid & Ambient Glows */}
      <View style={styles.gridOverlay}>
        <LinearGradient colors={['rgba(191, 90, 242, 0.02)', 'transparent']} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={styles.ambientGlow} />

      {/* Floating HUD Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.hudTag}>[ ENTROPY RECONFIGURATION ]</Text>
          <Text style={styles.headerTitle}>{step === 'verify' ? 'VERIFY ENCLAVE' : 'NEW MASTER KEY'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.innerContent, { opacity: fadeAnim }]}>
          {step === 'verify' ? (
            <View style={styles.dataPod}>
              <View style={styles.podHeader}>
                <Text style={styles.podTag}>[ MOD_01 // AUTHORIZE ]</Text>
                <View style={styles.podDot} />
              </View>

              <Text style={styles.sectionSubtitle}>
                Verification of the current Master PIN is required before modifying security parameters.
              </Text>

              <InputPod
                label="Current Master PIN"
                icon="lock-closed-outline"
                placeholder="Enter current 6+ digit PIN"
                value={currentPin}
                onChangeText={setCurrentPin}
                keyboardType="number-pad"
                secureTextEntry
              />

              <TouchableOpacity 
                style={[styles.saveNodeBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center' }]} 
                onPress={handleVerify}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveNodeText, { color: '#FFFFFF' }]}>
                  {isLoading ? 'DECRYPTING...' : 'VERIFY AUTHENTICATION'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dataPod}>
              <View style={styles.podHeader}>
                <Text style={styles.podTag}>[ MOD_02 // KEY ROTATION ]</Text>
                <View style={[styles.podDot, { backgroundColor: '#34d399' }]} />
              </View>

              <Text style={styles.sectionSubtitle}>
                Configure a new secure Master PIN. This PIN derives the AES-256 keys. Do not forget it.
              </Text>

              <InputPod
                label="New Master PIN"
                icon="key-outline"
                placeholder="Enter new 6+ digit PIN"
                value={newPin}
                onChangeText={setNewPin}
                keyboardType="number-pad"
                secureTextEntry
              />

              <InputPod
                label="Confirm Master PIN"
                icon="checkmark-circle-outline"
                placeholder="Re-enter new PIN"
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="number-pad"
                secureTextEntry
              />

              <TouchableOpacity 
                style={[styles.saveNodeBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center' }]} 
                onPress={handleChange}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveNodeText, { color: '#FFFFFF' }]}>
                  {isLoading ? 'UPDATING...' : 'COMMIT NEW PIN'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#020204' 
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  ambientGlow: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(191, 90, 242, 0.015)',
    filter: Platform.OS === 'ios' ? 'blur(100px)' : undefined,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  hudTag: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 60,
  },
  innerContent: {
    flex: 1,
  },
  dataPod: {
    backgroundColor: '#0D0D12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    gap: 16,
  },
  podHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  podTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  podDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 20,
    marginBottom: 8,
  },
  saveNodeBtn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },
  saveNodeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNodeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
