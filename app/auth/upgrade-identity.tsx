import { View, Text, Pressable, ScrollView, StyleSheet, Animated, Alert, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InputPod } from '../../components';
import { upgradeToIdentity, resendVerificationEmail, isIdentityLinked } from '../../lib/sync/identity';

const { width, height } = Dimensions.get('window');

export default function UpgradeIdentityScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  
  const headerAnim = useRef(new Animated.Value(0)).current;
  const podAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.spring(headerAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(podAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(btnAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    isIdentityLinked().then((linked) => {
      if (linked) {
        router.back();
      }
    });
  }, []);

  const handleUpgrade = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }
    if (!password || password.length < 8) {
      Alert.alert('Required', 'Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await upgradeToIdentity(email.trim(), password);
      if (result.needsVerification) {
        setNeedsVerification(true);
        Alert.alert(
          'Verification Dispatch',
          `A cryptographic verification link has been dispatched to ${email}. Check your mail nodes to proceed.`,
        );
      } else {
        Alert.alert('Sync Active', 'Your vault node is now linked for cross-device synchronization.');
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Linking Failed', e.message || 'Could not upgrade vault identity.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendVerificationEmail(email);
      Alert.alert('Dispatched', 'Verification mail resent.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const getInterpolatedTranslateY = (anim: Animated.Value) => {
    return anim.interpolate({
      inputRange: [0, 1],
      outputRange: [25, 0],
    });
  };

  if (needsVerification) {
    return (
      <View style={styles.container}>

        <View style={styles.gridOverlay}>
          <LinearGradient colors={['rgba(191, 90, 242, 0.015)', 'transparent']} style={StyleSheet.absoluteFillObject} />
        </View>

        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="close-outline" size={20} color="#8E8E93" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.hudTag}>[ VERIFY CLUSTER NODE ]</Text>
            <Text style={styles.headerTitle}>PENDING VERIFICATION</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.verifyState}>
          <View style={styles.verifyIconBox}>
            <Ionicons name="mail-open-outline" size={32} color="#BF5AF2" />
          </View>
          <Text style={styles.verifyTitle}>Awaiting Email Verification</Text>
          <Text style={styles.verifyText}>
            We have dispatched a security validation key to:{'\n'}
            <Text style={{ color: '#BF5AF2', fontWeight: 'bold' }}>{email}</Text>
            {'\n\n'}Please click the verification link in the mail node to initialize secure backup clusters.
          </Text>
          
          <TouchableOpacity onPress={handleResend} style={styles.verifyBtn} activeOpacity={0.8}>
            <Text style={styles.verifyBtnText}>RESEND VERIFICATION MAIL</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.back()} style={[styles.verifyBtn, { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.05)' }]} activeOpacity={0.8}>
            <Text style={[styles.verifyBtnText, { color: '#8E8E93' }]}>HALT LINK SYSTEM</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>

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
          <Text style={styles.hudTag}>[ IDENTITY PROVISIONING ]</Text>
          <Text style={styles.headerTitle}>LINK SECONDARY DEVICE</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[
          styles.dataPod,
          {
            opacity: podAnim,
            transform: [{ translateY: getInterpolatedTranslateY(podAnim) }]
          }
        ]}>
          <View style={styles.podHeader}>
            <Text style={styles.podTag}>[ MOD_01 // SECURE PAIRING ]</Text>
            <View style={styles.podDot} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Linking an identity allows you to decrypt and sync this vault across multiple authorized endpoints.
          </Text>

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
            placeholder="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Animated.View>

        <Animated.View style={{
          opacity: btnAnim,
          transform: [{ translateY: getInterpolatedTranslateY(btnAnim) }]
        }}>
          <TouchableOpacity 
            style={[styles.saveNodeBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }]} 
            onPress={handleUpgrade}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="link-outline" size={18} color="#FFFFFF" />
            <Text style={[styles.saveNodeText, { color: '#FFFFFF' }]}>
              {isLoading ? 'ESTABLISHING PROTOCOL...' : 'INITIALIZE LINKING'}
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
    gap: 8,
  },
  saveNodeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  verifyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  verifyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(191, 90, 242, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(191, 90, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  verifyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  verifyText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  verifyBtn: {
    height: 50,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(191, 90, 242, 0.15)',
    backgroundColor: 'rgba(191, 90, 242, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyBtnText: {
    color: '#BF5AF2',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
});
