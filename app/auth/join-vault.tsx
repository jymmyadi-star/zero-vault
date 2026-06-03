import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Alert, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputPod } from '../../components';
import { joinExistingVault } from '../../lib/sync/identity';
import { useVaultStore } from '../../lib/store/vault-store';

const { width, height } = Dimensions.get('window');

export default function JoinVaultScreen() {
  const insets = useSafeAreaInsets();
  const { unlock: unlockStore } = useVaultStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Animated values for staggered entrances
  const headerAnim = useRef(new Animated.Value(0)).current;
  const pod1Anim = useRef(new Animated.Value(0)).current;
  const pod2Anim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod1Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(pod2Anim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleJoin = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your account email.');
      return;
    }
    if (!password) {
      Alert.alert('Required', 'Please enter your password.');
      return;
    }
    if (!pin || pin.length < 8) {
      Alert.alert('Required', 'Please enter the Master PIN from your original device.');
      return;
    }

    setIsLoading(true);
    try {
      const keySet = await joinExistingVault(email.trim(), password, pin);
      unlockStore(keySet);
      Alert.alert('Restored', 'Your encrypted vault has been recovered and synchronization is active.', [
        { text: 'Acknowledge' },
      ]);
    } catch (e: any) {
      Alert.alert('Join Failed', e.message || 'Could not restore vault.');
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
        <LinearGradient colors={['rgba(191, 90, 242, 0.015)', 'transparent']} style={StyleSheet.absoluteFillObject} />
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
          <Text style={styles.hudTag}>[ VAULT RECONSTRUCTION ]</Text>
          <Text style={styles.headerTitle}>RESTORE REMOTE NODE</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* POD 1: IDENTITY ACCESS */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod1Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod1Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_01 // SECURED CLUSTER ]</Text>
            <View style={styles.podDot} />
          </View>

          <InputPod
            label="Email Address"
            icon="mail-outline"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputPod
            label="Security Passphrase"
            icon="lock-closed-outline"
            placeholder="Your account password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Animated.View>

        {/* POD 2: PIN DECRYPTION CORE */}
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: pod2Anim,
            transform: [{ translateY: getInterpolatedTranslateY(pod2Anim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_02 // SYMMETRIC MASTER PIN ]</Text>
            <View style={[styles.podDot, { backgroundColor: '#34d399' }]} />
          </View>

          <InputPod
            label="Master PIN"
            icon="shield-checkmark-outline"
            placeholder="6+ digit PIN from original device"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
          />

          <Text style={styles.explainer}>
            Provide the Master PIN configured on your primary vault endpoint. This PIN is mandatory to derive the decryption keys. Without it, your records remain completely unreadable.
          </Text>
        </Animated.View>

        {/* Action Commit */}
        <Animated.View style={{
          opacity: btnAnim,
          transform: [{ translateY: getInterpolatedTranslateY(btnAnim) }]
        }}>
          <TouchableOpacity 
            style={[styles.saveNodeBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }]} 
            onPress={handleJoin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="enter-outline" size={18} color="#FFFFFF" />
            <Text style={[styles.saveNodeText, { color: '#FFFFFF' }]}>
              {isLoading ? 'DECRYPTING STORAGE...' : 'RECONSTRUCT VAULT'}
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
    right: -width * 0.2,
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
    color: '#BF5AF2',
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
    gap: 20,
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
    backgroundColor: '#BF5AF2',
  },
  explainer: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 18,
    paddingHorizontal: 4,
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
    gap: 8,
  },
  saveNodeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
