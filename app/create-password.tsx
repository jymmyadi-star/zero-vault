import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Alert, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputPod, PasswordField } from '../components';
import { createVaultItem, updateVaultItem, getVaultItemById } from '../lib/services/vault-service';
import { generatePassword, calculateEntropy, entropyLabel } from '../lib/crypto/password-generator';

import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function CreatePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [folder, setFolder] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Animated values for staggered pod entrances
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pod1Anim = useRef(new Animated.Value(0)).current;
  const pod2Anim = useRef(new Animated.Value(0)).current;
  const pod3Anim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  // Animated value for password strength entropy bar
  const entropyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Run staggered entrance animations
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod1Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod2Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod3Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const loadEditItem = async () => {
      const params = router.canGoBack() ? {} : (globalThis as any).__zerovault_lastParams || {};
      const id = params.editId as string;
      if (!id) return;

      try {
        const item = await getVaultItemById(id);
        if (item && item.itemType === 'password') {
          setEditId(id);
          setTitle(item.title);
          setFolder(item.folder || '');
          setUrl(item.urlHint || '');
          const p = item.payload as any;
          setUsername(p.username || '');
          setPassword(p.password || '');
          setNotes(p.notes || '');
          setTotpSecret(p.totpSecret || '');
        }
      } catch {}
    };

    loadEditItem();
  }, []);

  const entropy = calculateEntropy(password);

  useEffect(() => {
    Animated.spring(entropyAnim, {
      toValue: entropy,
      tension: 100,
      friction: 12,
      useNativeDriver: false, // Width animation requires false
    }).start();
  }, [entropy]);

  const handleGeneratePassword = () => {
    hapticTouch();
    const pwd = generatePassword({ length: 24 });
    setPassword(pwd);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      hapticWarning();
      Alert.alert('Required', 'Please enter a title for this record.');
      return;
    }
    if (!password) {
      hapticWarning();
      Alert.alert('Required', 'Please enter or generate a password.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        username: username.trim(),
        password,
        url: url.trim(),
        notes: notes.trim(),
        totpSecret: totpSecret.trim().replace(/\s/g, ''),
        customFields: [],
      };

      if (editId) {
        await updateVaultItem(editId, {
          title,
          plainPayload: payload,
          folder: folder.trim() || null,
          urlHint: url.trim() || null,
        });
      } else {
        await createVaultItem('password', title, payload, {
          urlHint: url.trim() || undefined,
          folder: folder.trim() || undefined,
          icon: 'key',
        });
      }
      await hapticSuccess();
      router.back();
    } catch (e: any) {
      Alert.alert('Encryption Error', e.message || 'Failed to securely save record.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    const label = entropyLabel(entropy);
    if (label === 'weak') return '#FF3B30';
    if (label === 'medium') return '#FF9F0A';
    return '#34C759';
  };

  const entropyWidth = entropyAnim.interpolate({
    inputRange: [0, 128],
    outputRange: ['0%', '100%'],
  });

  const getInterpolatedTranslateY = (anim: Animated.Value) => {
    return anim.interpolate({
      inputRange: [0, 1],
      outputRange: [25, 0],
    });
  };

  return (
    <View style={styles.container}>

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
          <Text style={styles.hudTag}>[ SECURE ENCLAVE NODE ]</Text>
          <Text style={styles.headerTitle}>{editId ? 'DECRYPT & EDIT' : 'GENERATE VAULT NODE'}</Text>
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
        {/* POD 1: IDENTITY */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod1Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod1Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_01 // IDENTITY ]</Text>
            <View style={styles.podDot} />
          </View>

          <InputPod
            label="Service Title"
            icon="server-outline"
            placeholder="e.g. ProtonMail, GitHub"
            value={title}
            onChangeText={setTitle}
            autoCapitalize="words"
            style={styles.podInput}
          />

          <InputPod
            label="Username / Identifier"
            icon="person-outline"
            placeholder="Email or Username"
            value={username}
            onChangeText={setUsername}
            style={styles.podInput}
          />
        </Animated.View>

        {/* POD 2: CRYPTOGRAPHY */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod2Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod2Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_02 // CRYPTOGRAPHY ]</Text>
            <View style={[styles.podDot, { backgroundColor: getStrengthColor() }]} />
          </View>

          <PasswordField
            label="Cryptographic Key"
            placeholder="Enter secure key"
            value={password}
            onChangeText={setPassword}
          />

          {/* Real-time Entropy HUD */}
          {password.length > 0 && (
            <View style={styles.entropyHud}>
              <View style={styles.entropyBarBg}>
                <Animated.View 
                  style={[
                    styles.entropyBarActive, 
                    { width: entropyWidth, backgroundColor: getStrengthColor() }
                  ]} 
                />
              </View>
              <Text style={[styles.entropyText, { color: getStrengthColor() }]}>
                {entropy} BIT ENTROPY // {entropyLabel(entropy).toUpperCase()}
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={handleGeneratePassword} style={styles.reactorBtn} activeOpacity={0.8}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="flash" size={14} color="#FFFFFF" />
            <Text style={styles.reactorBtnText}>GENERATE HIGH-ENTROPY KEY</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* POD 3: META & DESTINATIONS */}
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
            label="Destination URL"
            icon="globe-outline"
            placeholder="https://..."
            value={url}
            onChangeText={setUrl}
            keyboardType="url"
            style={styles.podInput}
          />

          <InputPod
            label="Secure Folder"
            icon="folder-outline"
            placeholder="Work, Finance, Personal"
            value={folder}
            onChangeText={setFolder}
            autoCapitalize="words"
            style={styles.podInput}
          />

          <InputPod
            label="TOTP Secret (Base32)"
            icon="timer-outline"
            placeholder="Key for 2FA verification"
            value={totpSecret}
            onChangeText={(t) => setTotpSecret(t.toUpperCase())}
            style={styles.podInput}
          />

          <InputPod
            label="Secure Memo"
            icon="document-text-outline"
            placeholder="Recovery keys, security questions..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={styles.podInput}
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
              {isLoading ? 'ENCRYPTING PAYLOAD...' : 'COMMIT SECURE RECORD'}
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
    backgroundColor: 'transparent' 
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
    backgroundColor: 'rgba(0, 240, 255, 0.015)',
    filter: Platform.OS === 'ios' ? 'blur(100px)' : undefined, // Native blur on iOS
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
    backgroundColor: '#00F0FF',
  },
  podInput: {
  },
  entropyHud: {
    gap: 8,
    marginTop: 4,
  },
  entropyBarBg: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  entropyBarActive: {
    height: '100%',
    borderRadius: 3,
  },
  entropyText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  reactorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reactorBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    letterSpacing: 1.2,
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
