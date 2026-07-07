import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TurturicaMascot } from '../../components/ui/TurturicaMascot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RedTunnelBackground } from '@/components/RedTunnelBackground';
import { LiquidGlassButton } from '@/components/LiquidGlassButton';
import { BlurView } from 'expo-blur';
import { hapticSuccess } from '@/lib/haptics';
import { enableSync } from '@/lib/sync/index';

export default function VaultCreatedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Animations
  const ringScale = useSharedValue(0.5);
  const ringOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(20);
  const pulseScale = useSharedValue(1);
  const btnOpacity = useSharedValue(0);

  useEffect(() => {
    // Automatically enable sync behind the scenes so the extension can pair immediately
    import('../../lib/consent-manager').then(m => {
      m.consentManager.grant('cloud_sync').then(() => enableSync());
    });

    const smooth = { duration: 600, easing: Easing.out(Easing.quad) };

    // Outer ring fade in
    ringOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
    ringScale.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 150 }));

    // Checkmark burst
    checkScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 200 }));
    
    // Haptic pop
    setTimeout(() => {
      hapticSuccess();
    }, 450);

    // Continuous pulse
    setTimeout(() => {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, 800);

    // Text reveal
    textOpacity.value = withDelay(700, withTiming(1, smooth));
    textY.value = withDelay(700, withTiming(0, smooth));

    // Button reveal
    btnOpacity.value = withDelay(1200, withTiming(1, smooth));
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
  }));

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <RedTunnelBackground />

      <View style={styles.content}>
        <Text style={styles.hudTechnical}>SYS.AUTH.CORE_V3 // VAULT_INITIALIZED</Text>

        <View style={styles.heroWrap}>
          {/* Pulsing neon ring */}
          <Animated.View style={[styles.outerRing, ringStyle, pulseStyle]} />

          <Animated.View style={[styles.innerRing, ringStyle]}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Animated.View style={checkStyle}>
              <TurturicaMascot size={60} />
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.textBlock, textStyle]}>
          <Text style={styles.title}>VAULT SECURED</Text>
          <Text style={styles.subtitle}>
            AES-256 ENCRYPTION ACTIVE.{'\n'}
            NO DATA LEAVES YOUR DEVICE.
          </Text>

          <View style={styles.statsBox}>
            <View style={styles.statRow}>
              <Ionicons name="key" size={14} color="#00F0FF" />
              <Text style={styles.statText}>LOCAL ENCLAVE</Text>
              <Text style={styles.statValue}>ONLINE</Text>
            </View>
            <View style={styles.statRow}>
              <Ionicons name="lock-closed" size={14} color="#00F0FF" />
              <Text style={styles.statText}>ZERO-KNOWLEDGE</Text>
              <Text style={styles.statValue}>VERIFIED</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, btnStyle]}>
        <LiquidGlassButton
          title="ENTER VAULT"
          onPress={() => router.replace('/(tabs)')}
          width={280}
          height={60}
          color="#00F0FF"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hudTechnical: {
    fontSize: 10,
    color: 'rgba(0, 240, 255, 0.6)',
    letterSpacing: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    position: 'absolute',
    top: 80,
  },
  heroWrap: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  outerRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(0, 240, 255, 0.4)',
    shadowColor: '#00F0FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  innerRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.8)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  textBlock: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#00F0FF',
    textAlign: 'center',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 240, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 40,
  },
  statsBox: {
    width: '100%',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.2)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
    marginLeft: 8,
    flex: 1,
  },
  statValue: {
    fontSize: 11,
    color: '#00F0FF',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
});
