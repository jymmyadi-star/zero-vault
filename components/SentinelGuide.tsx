import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  TouchableOpacity,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSentinelStore } from '../lib/store/sentinel-store';
import { hapticTouch } from '../lib/haptics';
import { TurturicaMascot } from './ui/TurturicaMascot';
import { kv } from '../lib/storage';

const { width, height } = Dimensions.get('window');
const STORAGE_KEY = '@zerovault_copilot_seen';

const MISSIONS = {
  first_login: [
    {
      id: 0,
      text: "System initialized. I am your Enclave Sentinel. Let's take a quick tour of your new perimeter. Tap to continue.",
      yPos: height * 0.1,
      targetRoute: '/',
      autoAdvanceOnRoute: '/create-password',
      align: 'left',
    },
    {
      id: 1,
      text: "This is the Password Forge. Your credentials are encrypted locally with XChaCha20-Poly1305 before leaving memory.",
      yPos: height * 0.65,
      targetRoute: '/create-password',
      autoAdvanceOnRoute: '/create-seed',
      align: 'right',
    },
    {
      id: 2,
      text: "Here is the Seed Vault. You can safely store BIP39 recovery phrases for your crypto wallets. Completely zero-knowledge.",
      yPos: height * 0.65,
      targetRoute: '/create-seed',
      autoAdvanceOnRoute: '/create-note',
      align: 'left',
    },
    {
      id: 3,
      text: "This is the Secure Notes module. Perfect for classified text, bank details, or private architecture plans.",
      yPos: height * 0.65,
      targetRoute: '/create-note',
      autoAdvanceOnRoute: '/settings',
      align: 'right',
    },
    {
      id: 4,
      text: "This is the Command Center. Manage your biometric locks, auto-lock timers, or purge your vault data.",
      yPos: height * 0.1,
      targetRoute: '/settings',
      autoAdvanceOnRoute: '/',
      align: 'left',
    },
    {
      id: 5,
      text: "Tour complete! Node secured and synchronized. Your enclave is now fully operational.",
      yPos: height * 0.1,
      targetRoute: '/',
      autoAdvanceOnRoute: null,
      align: 'right',
    },
  ],
};

function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(text.substring(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 25); 

    return () => clearInterval(interval);
  }, [text]);

  return <Text style={styles.dialogText}>{displayedText}<Text style={styles.cursor}>_</Text></Text>;
}

export function SentinelGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const { isActive, currentStepIndex, mission, activateMission, advanceStep, completeMission } = useSentinelStore();
  
  const [isTyping, setIsTyping] = useState(true);

  // Initial setup: check AsyncStorage on app load and pathname change
  useEffect(() => {
    const init = async () => {
      try {
        // Ensure the auth flow (Phrase Setup) is completed first
        const isVerified = kv.get('zerovault_phrase_verified') === 'true';
        if (!isVerified) {
          // If vault was purged or unverified, wipe the Mascot's memory so it can introduce itself again later
          await AsyncStorage.removeItem(STORAGE_KEY);
          return;
        }

        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (seen !== 'true') {
          activateMission('first_login');
        }
      } catch (e) {
        console.error(e);
      }
    };
    
    // Only attempt to start mission if none is active
    if (mission === 'none') {
      init();
    }
  }, [pathname]);

  const currentSteps = mission !== 'none' ? MISSIONS[mission] : [];
  const step = currentSteps ? currentSteps[currentStepIndex] : null;

  const posYAnim = useRef(new Animated.Value(height * 0.4)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in when active
  useEffect(() => {
    if (isActive) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -8, duration: 1000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 8, duration: 2000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  // Handle auto-advancing based on route changes
  useEffect(() => {
    if (!isActive || !step) return;

    if (step.autoAdvanceOnRoute && pathname === step.autoAdvanceOnRoute) {
      setIsTyping(true);
      advanceStep();
    }
  }, [pathname, isActive, step, advanceStep]);

  // Animate position when step changes
  useEffect(() => {
    if (step) {
      Animated.spring(posYAnim, {
        toValue: step.yPos,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  }, [currentStepIndex, step]);

  const handleNext = async () => {
    if (!step) return;
    
    if (isTyping) {
      // Fast forward
      setIsTyping(false);
      return;
    }

    hapticTouch();

    // If it's the last step, or if there's no auto-advance, clicking means finish or next
    const isLastStep = currentStepIndex >= currentSteps.length - 1;
    
    if (isLastStep) {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        completeMission();
      });
    } else {
      setIsTyping(true);
      if (step.autoAdvanceOnRoute && pathname !== step.autoAdvanceOnRoute) {
        router.push(step.autoAdvanceOnRoute as any);
      }
      advanceStep();
    }
  };

  if (!isActive || !step) return null;

  // We don't want a global blur overlay anymore, because the user needs to interact with the UI beneath!
  // We just let the Sentinel float on top via pointerEvents="box-none" on the container.

  return (
    <Modal transparent={true} visible={isActive} animationType="none" hardwareAccelerated={true}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]} pointerEvents="box-none">
        <Animated.View 
          style={[
            styles.guideWrapper, 
            { 
              transform: [
                { translateY: Animated.add(posYAnim, floatAnim) }
              ] 
            }
          ]}
        >
          <View style={[
            styles.chatRow, 
            step.align === 'right' ? { flexDirection: 'row-reverse' } : { flexDirection: 'row' }
          ]}>
            <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
              <TurturicaMascot size={55} />
            </Animated.View>

            <TouchableOpacity 
              activeOpacity={0.8} 
              onPress={handleNext} 
              style={[
                styles.bubbleWrapper,
                step.align === 'right' 
                  ? { borderTopLeftRadius: 24, borderTopRightRadius: 4, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
                  : { borderTopLeftRadius: 4, borderTopRightRadius: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }
              ]}
            >
              <BlurView intensity={90} tint="dark" style={styles.bubbleBox}>
                <LinearGradient colors={['rgba(20, 0, 5, 0.85)', 'rgba(0, 0, 0, 0.98)']} style={StyleSheet.absoluteFillObject} />
                <LinearGradient
                  colors={['transparent', 'rgba(255, 0, 51, 1)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }}
                />
                
                <View style={styles.dialogHeader}>
                  <Text style={styles.dialogTitle}>ENCLAVE SENTINEL</Text>
                </View>

                <View style={styles.dialogContent}>
                  {isTyping ? (
                    <TypewriterText text={step.text} onComplete={() => setIsTyping(false)} />
                  ) : (
                    <Text style={styles.dialogText}>{step.text}</Text>
                  )}
                </View>

                <View style={styles.dialogFooter}>
                  <Text style={styles.tapToContinue}>
                    {currentStepIndex >= currentSteps.length - 1 ? 'TAP TO SEAL VAULT' : (step.autoAdvanceOnRoute ? 'PERFORM ACTION OR TAP TO SKIP' : 'TAP TO CONTINUE')}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color="rgba(255, 0, 51, 0.9)" />
                </View>
              </BlurView>
            </TouchableOpacity>
          </View>
        </Animated.View>
    </Animated.View>
  </Modal>
);
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, // Float above everything
    elevation: 9999,
  },
  guideWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
  },
  chatRow: {
    width: '100%',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarContainer: {
    width: 55,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleWrapper: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.35)',
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 20,
  },
  bubbleBox: {
    padding: 20,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '800',
    letterSpacing: 4,
  },
  dialogContent: {
    minHeight: 70,
  },
  dialogText: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  cursor: {
    color: '#FF0033',
    fontWeight: '800',
  },
  dialogFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 16,
  },
  tapToContinue: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
