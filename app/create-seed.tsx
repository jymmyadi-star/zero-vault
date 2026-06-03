import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Alert, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputPod } from '../components';
import { createVaultItem, updateVaultItem, getVaultItemById } from '../lib/services/vault-service';

import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');
const VALID_WORD_COUNTS = [12, 15, 18, 21, 24];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function CreateSeedScreen() {
  const insets = useSafeAreaInsets();
  const [walletName, setWalletName] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [derivationPath, setDerivationPath] = useState("m/44'/60'/0'/0/0");
  const [notes, setNotes] = useState('');
  const [folder, setFolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Animated values for staggered entrances
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pod1Anim = useRef(new Animated.Value(0)).current;
  const pod2Anim = useRef(new Animated.Value(0)).current;
  const pod3Anim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Run staggered spring entrance animations
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod1Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod2Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod3Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const loadSeed = async () => {
      try {
        const params = (globalThis as any).__zerovault_lastParams || {};
        const id = params.editId as string;
        if (!id) return;
        const item = await getVaultItemById(id);
        if (item && item.itemType === 'seed_phrase') {
          setEditId(id);
          const p = item.payload as any;
          setWalletName(item.title);
          setMnemonic(p.mnemonic || '');
          setPassphrase(p.passphrase || '');
          setDerivationPath(p.derivationPath || "m/44'/60'/0'/0/0");
          setNotes(p.notes || '');
          setFolder(item.folder || '');
        }
      } catch {}
    };
    loadSeed();
  }, []);

  const wordCount = countWords(mnemonic);
  const isValidCount = mnemonic.trim() ? VALID_WORD_COUNTS.includes(wordCount) : null;

  const handlePasteFromClipboard = async () => {
    hapticTouch();
    try {
      const { getStringAsync } = require('expo-clipboard');
      const text = await getStringAsync();
      if (text) setMnemonic(text.trim());
    } catch {
      Alert.alert('Clipboard', 'Could not read clipboard.');
    }
  };

  const handleSave = async () => {
    if (!walletName.trim() && !mnemonic.trim()) {
      hapticWarning();
      Alert.alert('Missing Fields', 'Wallet name and seed phrase are required.');
      return;
    }
    if (!mnemonic.trim()) {
      hapticWarning();
      Alert.alert('Missing Field', 'Seed phrase is required.');
      return;
    }
    if (!isValidCount) {
      hapticWarning();
      Alert.alert(
        'Invalid Seed Length',
        `Seed phrase has ${wordCount} words. Valid lengths: ${VALID_WORD_COUNTS.join(', ')}.`,
      );
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        walletName: walletName.trim() || 'Unnamed Wallet',
        mnemonic: mnemonic.trim(),
        passphrase: passphrase.trim(),
        derivationPath: derivationPath.trim(),
        notes: notes.trim(),
      };

      if (editId) {
        await updateVaultItem(editId, {
          title: walletName.trim() || 'Unnamed Wallet',
          plainPayload: payload,
          folder: folder.trim() || null,
        });
      } else {
        await createVaultItem('seed_phrase', walletName.trim() || 'Unnamed Wallet', payload, {
          folder: folder.trim() || undefined,
          icon: 'leaf',
        });
      }
      await hapticSuccess();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save seed phrase.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInterpolatedTranslateY = (anim: Animated.Value) => {
    return anim.interpolate({
      inputRange: [0, 1],
      outputRange: [25, 0],
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />

      {/* Cyber Grid & Ambient Glows */}
      <View style={styles.gridOverlay}>
        <LinearGradient colors={['rgba(0, 240, 255, 0.02)', 'transparent']} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={styles.ambientGlow} />

      {/* Floating HUD Header */}
      <Animated.View style={[
        styles.header, 
        { 
          paddingTop: insets.top + 16,
          opacity: headerAnim,
          transform: [{ translateY: getInterpolatedTranslateY(headerAnim) }]
        }
      ]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.hudTag}>[ RECOVERY ENCLAVE ]</Text>
          <Text style={styles.headerTitle}>{editId ? 'DECRYPT & EDIT' : 'GENERATE SEED NODE'}</Text>
        </View>
        <Pressable onPress={handleSave} disabled={isLoading} style={styles.saveBtn}>
          <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* POD 1: RECOVERY PHRASE */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod1Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod1Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_01 // KEYSPACE ]</Text>
            <View style={[styles.podDot, isValidCount ? styles.podDotValid : styles.podDotWarn]} />
          </View>

          <InputPod
            label="Wallet Name"
            icon="wallet-outline"
            placeholder="e.g. MetaMask Main"
            value={walletName}
            onChangeText={setWalletName}
            autoCapitalize="words"
          />

          <InputPod
            label="Mnemonic Phrase"
            icon="leaf-outline"
            placeholder="Enter or paste your 12/24 word seed phrase..."
            value={mnemonic}
            onChangeText={setMnemonic}
            multiline
            numberOfLines={5}
            autoCapitalize="none"
            contextMenuHidden={false}
          />

          <View style={styles.seedMeta}>
            <Pressable onPress={handlePasteFromClipboard} style={styles.pasteBtn} hitSlop={8}>
              <Ionicons name="clipboard-outline" size={13} color="#FFFFFF" />
              <Text style={styles.pasteText}>PASTE FROM CLIPBOARD</Text>
            </Pressable>
            {mnemonic.trim().length > 0 && (
              <View style={[styles.wordBadge, isValidCount ? styles.wordBadgeValid : styles.wordBadgeWarn]}>
                <Text style={[styles.wordBadgeText, isValidCount ? styles.wordBadgeTextValid : styles.wordBadgeTextWarn]}>
                  {wordCount} WORDS // {isValidCount ? 'BIP39 VALID' : 'NON-STANDARD'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* POD 2: ADVANCED PATHS */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod2Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod2Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_02 // DERIVATION ]</Text>
            <View style={styles.podDot} />
          </View>

          <InputPod
            label="Passphrase (25th Word)"
            icon="key-outline"
            placeholder="Optional BIP39 passphrase"
            value={passphrase}
            onChangeText={setPassphrase}
            contextMenuHidden
          />

          <InputPod
            label="Derivation Path"
            icon="git-branch-outline"
            placeholder="m/44'/60'/0'/0/0"
            value={derivationPath}
            onChangeText={setDerivationPath}
          />
        </Animated.View>

        {/* POD 3: META & NOTES */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod3Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod3Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_03 // ROUTING & EXTRA ]</Text>
            <View style={styles.podDot} />
          </View>

          <InputPod
            label="Secure Memo"
            icon="document-text-outline"
            placeholder="Wallet purpose, accounts..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />

          <InputPod
            label="Secure Folder"
            icon="folder-outline"
            placeholder="Crypto / Hot Wallets / Cold Storage"
            value={folder}
            onChangeText={setFolder}
            autoCapitalize="words"
          />
        </Animated.View>

        {/* Save Node Trigger */}
        <Animated.View style={{
          opacity: btnAnim,
          transform: [{ translateY: getInterpolatedTranslateY(btnAnim) }]
        }}>
          <TouchableOpacity 
            style={[styles.saveNodeBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10 }]} 
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
            <Text style={[styles.saveNodeText, { color: '#FFFFFF' }]}>
              {isLoading ? 'ENCRYPTING PAYLOAD...' : 'COMMIT SEED NODE'}
            </Text>
          </TouchableOpacity>
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
    right: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(52, 211, 153, 0.012)',
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
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 20,
  },
  dataPod: {
    backgroundColor: '#0D0D12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 16,
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
    backgroundColor: '#34d399',
  },
  podDotValid: {
    backgroundColor: '#34d399',
  },
  podDotWarn: {
    backgroundColor: '#FF9F0A',
  },
  seedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -4,
    paddingHorizontal: 4,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pasteText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  wordBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  wordBadgeValid: {
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    borderColor: 'rgba(52, 211, 153, 0.15)',
  },
  wordBadgeWarn: {
    backgroundColor: 'rgba(255, 159, 10, 0.05)',
    borderColor: 'rgba(255, 159, 10, 0.15)',
  },
  wordBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  wordBadgeTextValid: {
    color: '#34d399',
  },
  wordBadgeTextWarn: {
    color: '#FF9F0A',
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
    gap: 10,
  },
  saveNodeText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
