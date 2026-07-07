import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Animated, Easing, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useVaultAuth } from '../hooks/useVaultAuth';
import { RedTunnelBackground } from '../components/RedTunnelBackground';
import { LiquidGlassButton } from '../components/LiquidGlassButton';
import { TurturicaMascot } from '../components/ui/TurturicaMascot';
import { hapticTouch } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

function PinDots({ length, max, isError }: { length: number; max: number; isError: boolean }) {
  return (
    <View style={styles.pinDots}>
      {Array.from({ length: max }).map((_, i) => {
        const isActive = i < length;
        const scaleAnim = useRef(new Animated.Value(isActive ? 1 : 0.7)).current;
        const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.6)).current;

        useEffect(() => {
          Animated.parallel([
            Animated.spring(scaleAnim, { toValue: isActive ? 1 : 0.7, friction: 5, tension: 100, useNativeDriver: true }),
            Animated.timing(opacityAnim, { toValue: isActive ? 1 : 0.6, duration: 200, useNativeDriver: true })
          ]).start();
        }, [isActive]);

        return (
          <Animated.View key={i} style={[styles.pinDotContainer, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
            <View style={[styles.pinDot, isActive ? (isError ? styles.pinDotError : styles.pinDotFilled) : styles.pinDotEmpty]} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function PinKey({ digit, onPress, disabled }: { digit: string; onPress: () => void; disabled: boolean }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || !digit) return;
    hapticTouch();
    Animated.spring(scaleAnim, { toValue: 0.88, friction: 6, tension: 120, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    if (disabled || !digit) return;
    Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }).start();
  };

  if (!digit) return <View style={styles.pinKeyPlaceholder} />;

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[styles.pinKey, { transform: [{ scale: scaleAnim }] }]}>
        <View style={StyleSheet.absoluteFillObject}>
          <Svg width="72" height="72">
            <Defs>
              <SvgLinearGradient id={`btnGrad-${digit || 'empty'}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="rgba(255,255,255,0.8)" />
                <Stop offset="1" stopColor="transparent" />
              </SvgLinearGradient>
            </Defs>
            <Circle cx="36" cy="36" r="35.5" stroke={`url(#btnGrad-${digit || 'empty'})`} strokeWidth="0.5" fill="none" />
          </Svg>
        </View>
        <BlurView intensity={5} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={styles.pinKeyInner}>
          {digit === '⌫' ? (
            <Ionicons name="backspace-outline" size={26} color="#FFFFFF" />
          ) : (
            <Text style={styles.pinKeyText}>{digit}</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const PIN_LAYOUT = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

export default function UnlockScreen() {
  const auth = useVaultAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { 
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, easing: Easing.out(Easing.exp), useNativeDriver: true }).start(); 
    auth.checkVaultState(); 
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const handleClear = () => {
    hapticTouch();
    auth.handleClear();
  };

  if (auth.mode === 'loading') {
    return (
      <View style={styles.container}>
        <RedTunnelBackground />
        <Text style={styles.statusText}>INITIALIZING ENCLAVE...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <RedTunnelBackground />
      <Animated.View style={[styles.inner, { transform: [{ translateX: auth.shakeAnim }] }]}>
        
        {/* Quantum Sentinel Core (Ultimate Design) */}
        <View style={styles.quantumCoreContainer}>
          <View style={styles.quantumGlow} />

          {/* 3D Intersecting Gyroscope Orbits */}
          <Animated.View style={[styles.qOrbit, styles.qOrbit1, { transform: [{ rotateX: '70deg' }, { rotateZ: spin }] }]} />
          <Animated.View style={[styles.qOrbit, styles.qOrbit2, { transform: [{ rotateY: '70deg' }, { rotateZ: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }]} />
          <Animated.View style={[styles.qOrbit, styles.qOrbit3, { transform: [{ rotateX: '50deg' }, { rotateY: '50deg' }, { rotateZ: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) }] }]} />

          {/* Micro-measurement Outer Ring */}
          <Animated.View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}>
            <Svg width="160" height="160">
              <Circle cx="80" cy="80" r="75" stroke="rgba(255, 0, 51, 0.7)" strokeWidth="0.5" strokeDasharray="1 8" fill="none" />
              <Circle cx="80" cy="80" r="62" stroke="rgba(255, 0, 51, 0.4)" strokeWidth="1.5" strokeDasharray="15 45" fill="none" />
            </Svg>
          </Animated.View>

          {/* Glass Nucleus */}
          <View style={styles.glassNucleusWrapper}>
            <BlurView intensity={20} tint="dark" style={styles.glassNucleus}>
              <LinearGradient colors={['rgba(255, 0, 51, 0.1)', 'rgba(0, 0, 0, 0.9)'] } style={StyleSheet.absoluteFillObject} />
              <TurturicaMascot size={55} />
            </BlurView>
          </View>
        </View>

        <Text style={styles.hudTechnical}>SYS.AUTH.CORE_V3 // ENCLAVE_ENGAGED</Text>

        <View style={styles.titleContainer}>
          <View style={styles.titleLineLeft} />
          <Text style={styles.title}>
            {auth.mode === 'setup' ? 'CREATE MASTER PASSWORD' :
             auth.mode === 'setup_confirm' ? 'CONFIRM MASTER PASSWORD' :
             auth.mode === 'locked' ? 'VAULT LOCKED' :
             auth.mode === 'mnemonic_show' ? 'RECOVERY SEED' :
             auth.mode === 'recover' ? 'ENTER RECOVERY PHRASE' :
             auth.mode === 'recover_pin' ? (auth.processing ? 'DERIVING KEYS...' : 'NEW MASTER PASSWORD') :
             (auth.processing ? 'UNLOCKING...' : 'ENTER MASTER PASSWORD')}
          </Text>
          <View style={styles.titleLineRight} />
        </View>

        {auth.mode === 'locked' ? (
          <Text style={styles.lockedText}>Too many failed attempts. Vault is locked for security.</Text>
        ) : auth.mode === 'mnemonic_show' ? (
          <View style={styles.mnemonicBox}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={styles.mnemonicText}>{auth.generatedMnemonic}</Text>
            <Text style={styles.mnemonicWarning}>Write these 24 words on paper. Never share them. This is the ONLY way to recover your vault.</Text>
            <View style={{ marginTop: 20 }}>
              <LiquidGlassButton
                title="ENTER VAULT"
                onPress={auth.handleSkipRecovery}
                width={180}
                height={50}
                color="#00F0FF" // Cyan for entry
              />
            </View>
          </View>
        ) : auth.mode === 'recover' ? (
          <View style={{ width: '100%', alignItems: 'center' }}>
            <TextInput
              style={styles.recoveryInput}
              multiline
              placeholder="Paste your 12/24 word recovery phrase here... It will automatically advance when 12 or 24 valid words are detected."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={auth.recoveryInput}
              onChangeText={auth.handleRecoveryInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={false}
            />
            {auth.error ? <Text style={styles.errorText}>[!] {auth.error.toUpperCase()}</Text> : null}
            <TouchableOpacity style={{ marginTop: 24 }} onPress={() => { auth.setMode('unlock'); auth.setRecoveryInput(''); }}>
              <Text style={styles.forgotLink}>CANCEL RECOVERY</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {auth.processing ? (
              <View style={styles.spinnerContainer}>
                <ActivityIndicator size="large" color="#FF0033" />
              </View>
            ) : (
              <>
            <PinDots
              length={auth.mode === 'setup_confirm' ? auth.confirmPin.length : auth.pin.length}
              max={auth.MIN_PASSWORD_LENGTH}
              isError={!!auth.error}
            />

            <View style={styles.feedbackContainer}>
              {auth.error ? <Text style={styles.errorText}>[!] {auth.error.toUpperCase()}</Text> : null}
              {auth.mode === 'setup_confirm' ? <Text style={styles.hintText}>RE-ENTER TO CONFIRM</Text> : null}
              {auth.mode === 'unlock' && auth.pin.length === 0 && !auth.error ? (
                <TouchableOpacity onPress={() => auth.setMode('recover')} activeOpacity={0.7} style={styles.forgotBtn}>
                  <Text style={styles.forgotLink}>RECOVER ACCESS</Text>
                  <Ionicons name="chevron-forward" size={10} color="rgba(255,255,255,0.4)" style={{ marginTop: 1 }} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.pinGrid}>
              {PIN_LAYOUT.map((row, ri) => (
                <View key={ri} style={styles.pinRow}>
                  {row.map((digit, ci) => (
                    <PinKey 
                      key={ci}
                      digit={digit}
                      onPress={() => digit === '⌫' ? auth.handleBackspace() : digit ? auth.handleKeyPress(digit) : null}
                      disabled={auth.processing || (!digit && digit !== '')}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={styles.clearContainer}>
              {auth.pin.length > 0 && (
                <TouchableOpacity onPress={handleClear} style={styles.clearBtn} activeOpacity={0.7}>
                  <Text style={styles.clearText}>Clear Entry</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
            )}
          </>
        )}
      </Animated.View>

      {auth.mode === 'locked' && (
        <View style={styles.deleteBtnContainer}>
          <LiquidGlassButton
            title="DELETE VAULT & RESET"
            onPress={auth.handleDeleteVault}
            width={240}
            height={55}
            color="#FF0033"
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  
  inner: { alignItems: 'center', paddingHorizontal: 32, width: '100%' },
  
  // Quantum Sentinel Core
  quantumCoreContainer: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  quantumGlow: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#FF0033', opacity: 0.25, shadowColor: '#FF0033', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 70, elevation: 30 },
  qOrbit: { position: 'absolute', borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255, 0, 51, 0.5)' },
  qOrbit1: { width: 150, height: 150, borderStyle: 'dashed' },
  qOrbit2: { width: 140, height: 140, borderStyle: 'dotted', borderWidth: 2 },
  qOrbit3: { width: 130, height: 130, borderTopColor: '#FF0033', borderBottomColor: '#FF0033', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderWidth: 1.5 },
  glassNucleusWrapper: { position: 'absolute', width: 96, height: 96, borderRadius: 48, overflow: 'hidden', shadowColor: '#FF0033', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 30 },
  glassNucleus: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  
  // Typography & HUD
  hudTechnical: { fontSize: 8, color: 'rgba(255,100,100,0.6)', letterSpacing: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 12, textAlign: 'center' },
  titleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, width: '100%', paddingHorizontal: 20, justifyContent: 'center' },
  titleLineLeft: { width: 30, height: 1, backgroundColor: 'rgba(255,0,50,0.4)', marginRight: 16 },
  titleLineRight: { width: 30, height: 1, backgroundColor: 'rgba(255,0,50,0.4)', marginLeft: 16 },
  title: { fontSize: 10, fontWeight: '800', color: '#FFFFFF', letterSpacing: 5, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textShadowColor: 'rgba(255,0,0,0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  statusText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#8E8E93', letterSpacing: 3 },
  recoveryInput: { width: '80%', minHeight: 140, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,0,50,0.5)', borderRadius: 12, color: '#FFFFFF', padding: 16, fontSize: 16, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', textAlignVertical: 'top' },
  spinnerContainer: { flexDirection: 'row', gap: 20, marginBottom: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  spinnerIcon: { opacity: 0.8 },
  
  // PIN Dots (Diamonds)
  pinDots: { flexDirection: 'row', gap: 20, marginBottom: 24, height: 24, alignItems: 'center' },
  pinDotContainer: { width: 14, height: 14, justifyContent: 'center', alignItems: 'center' },
  pinDot: { width: 10, height: 10, transform: [{ rotate: '45deg' }] }, // Cyber-Diamond shape
  pinDotEmpty: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  pinDotFilled: { backgroundColor: '#FF0033', shadowColor: '#FF0033', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 5 },
  pinDotError: { backgroundColor: '#FF0000', shadowColor: '#FF0000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 15, elevation: 5 },
  
  // Feedback Messages
  feedbackContainer: { height: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  errorText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF453A', letterSpacing: 1.5, fontWeight: '700' },
  hintText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#8E8E93', letterSpacing: 2 },
  forgotBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  forgotLink: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5, fontWeight: '600' },
  
  // PIN Grid
  pinGrid: { gap: 16, marginBottom: 8 },
  pinRow: { flexDirection: 'row', gap: 16 },
  pinKeyPlaceholder: { width: 72, height: 72, margin: 6 },
  pinKey: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', backgroundColor: 'transparent' },
  pinKeyInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pinKeyText: { fontSize: 32, fontWeight: '300', color: '#FFFFFF', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  
  // Clear Button
  clearContainer: { height: 40, justifyContent: 'center', alignItems: 'center', marginTop: -4 },
  clearBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,59,48,0.1)' },
  clearText: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF453A', fontWeight: '600', letterSpacing: 1 },
  
  // Mnemonic Box
  mnemonicBox: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)', padding: 24, width: '100%', overflow: 'hidden' },
  mnemonicText: { fontSize: 14, color: '#00F0FF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 26, marginBottom: 24, textAlign: 'center', fontWeight: '600' },
  mnemonicWarning: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#FF453A', textAlign: 'center', marginBottom: 24, lineHeight: 16 },
  actionBtn: { borderRadius: 14, overflow: 'hidden', shadowColor: '#00F0FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  actionGradient: { paddingVertical: 16, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#000000', letterSpacing: 1.5 },
  
  // Locked State
  lockedText: { fontSize: 13, color: '#8E8E93', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  deleteBtnContainer: { position: 'absolute', bottom: 60, width: '100%', alignItems: 'center' },
});
