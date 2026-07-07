import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TextInput, Platform, KeyboardAvoidingView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { LiquidGlassButton } from '@/components/LiquidGlassButton';
import { useVaultStore } from '@/lib/store/vault-store';
import { kv } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RecoveryPhraseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tempMnemonic = useVaultStore((s) => s.tempMnemonic);
  const setTempMnemonic = useVaultStore((s) => s.setTempMnemonic);

  const [step, setStep] = useState<'show' | 'verify'>('show');
  const [words, setWords] = useState<string[]>([]);
  const [verifyIndices, setVerifyIndices] = useState<number[]>([]);
  const [userInputs, setUserInputs] = useState<string[]>(['', '', '']);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tempMnemonic) {
      setWords(tempMnemonic.split(' '));
    } else {
      kv.set('zerovault_phrase_verified', 'true');
      router.replace('/(tabs)');
    }
  }, [tempMnemonic]);

  const startVerification = () => {
    if (words.length === 0) return;
    const indices = new Set<number>();
    while (indices.size < 3) {
      indices.add(Math.floor(Math.random() * words.length));
    }
    const sorted = Array.from(indices).sort((a, b) => a - b);
    setVerifyIndices(sorted);
    setStep('verify');
  };

  const handleVerify = async () => {
    let isValid = true;
    for (let i = 0; i < 3; i++) {
      const idx = verifyIndices[i];
      if (idx === undefined) { isValid = false; break; }
      const expectedWord = words[idx];
      if (!expectedWord || (userInputs[i]?.trim().toLowerCase() ?? '') !== expectedWord.toLowerCase()) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      setError('Incorrect words. Please try again.');
      await hapticError();
      return;
    }

    await hapticSuccess();
    setError(null);
    
    kv.set('zerovault_phrase_verified', 'true');
    setTempMnemonic(null);
    router.replace('/auth/vault-created');
  };

  const handleCopySeed = async () => {
    await Clipboard.setStringAsync(words.join(' '));
    await hapticSuccess();
  };

  const Background = () => (
    <LinearGradient
      colors={['#000000', '#030816', '#06102B']}
      style={StyleSheet.absoluteFillObject}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    />
  );

  if (step === 'show') {
    return (
      <View style={styles.root}>
        <Background />
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: (insets?.top || 0) + 20, paddingBottom: (insets?.bottom || 0) + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>CORE GENESIS</Text>
              </View>
              <Text style={styles.title}>Recovery Seed</Text>
              <Text style={styles.subtitle}>
                Write down these {words.length} words in exactly this order.
              </Text>
            </View>

            <View style={styles.macOsCard}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={styles.grid}>
                {words.map((word, i) => (
                  <View key={i} style={styles.wordPill}>
                    <Text style={styles.wordIndex}>{String(i + 1).padStart(2, '0')}</Text>
                    <View style={styles.divider} />
                    <Text style={styles.wordText}>{word}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.warningBox}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="warning-outline" size={18} color="#FF9F0A" />
              <Text style={styles.warningText}>
                Never share this with anyone. Store offline.
              </Text>
            </View>

            <LiquidGlassButton
              title="I'VE WRITTEN IT DOWN"
              onPress={startVerification}
              width={320}
              height={55}
              color="#00F0FF"
            />

            <LiquidGlassButton
              title="COPY TO CLIPBOARD"
              onPress={handleCopySeed}
              width={320}
              height={55}
              color="#FFFFFF"
              style={{ marginTop: 16 }}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Background />
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: (insets?.top || 0) + 20, paddingBottom: (insets?.bottom || 0) + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>VERIFICATION</Text>
            </View>
            <Text style={styles.title}>Verify Seed</Text>
            <Text style={styles.subtitle}>
              Prove you have written the seed down correctly.
            </Text>
          </View>

          <View style={styles.macOsCard}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={{ padding: 24 }}>
              {verifyIndices.map((wordIndex, i) => (
                <View key={i} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Word #{wordIndex + 1}</Text>
                  <TextInput
                    style={styles.macOsInput}
                    value={userInputs[i]}
                    onChangeText={(txt) => {
                      setError(null);
                      const newInputs = [...userInputs];
                      newInputs[i] = txt;
                      setUserInputs(newInputs);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    placeholder="Enter word..."
                  />
                </View>
              ))}
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          </View>

          <LiquidGlassButton
            title="VERIFY & CONTINUE"
            onPress={handleVerify}
            width={320}
            height={55}
            color="#00F0FF"
          />

          <LiquidGlassButton
            title="GO BACK"
            onPress={() => setStep('show')}
            width={320}
            height={55}
            color="#FFFFFF"
            style={{ marginTop: 20 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { 
    flexGrow: 1, 
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  badge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 10,
    color: '#00F0FF',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    textAlign: 'center',
  },
  macOsCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 32,
    // macOS subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 10,
    justifyContent: 'space-between',
  },
  wordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '48%',
  },
  wordIndex: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.3)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
    minWidth: 20,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },
  wordText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    flexShrink: 1,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 10, 0.2)',
    backgroundColor: 'rgba(255, 159, 10, 0.05)',
  },
  warningText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    letterSpacing: 0.3,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  macOsInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    padding: 16,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});
