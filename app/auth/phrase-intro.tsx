import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolateColor,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticTouch, hapticSuccess } from '@/lib/haptics';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SW, height: SH } = Dimensions.get('window');

// Calculate the hypotenuse to ensure the circle covers the entire screen
const RADIUS = Math.sqrt(Math.pow(SW, 2) + Math.pow(SH, 2));
const SIZE = RADIUS * 2;

const SLIDES = [
  {
    bg: '#000000', // Abyssal Black
    title: 'ZERO KNOWLEDGE',
    subtitle: 'SYS.AUTH // ARCHITECTURE',
    desc: 'Your data is mathematically sealed. We cannot see it, we cannot access it, and we cannot recover it. You are the sole architect.',
    titleColor: '#00F0FF',
    descColor: 'rgba(255,255,255,0.7)',
    iconColor: '#00F0FF',
    icon: 'infinite-outline',
  },
  {
    bg: '#00F0FF', // Neon Cyan
    title: 'THE PRIMORDIAL SEED',
    subtitle: 'SYS.AUTH // GENESIS',
    desc: 'The 24-word sequence you are about to receive is the only mathematical path to restoration. If lost, your vault is gone forever.',
    titleColor: '#000000',
    descColor: 'rgba(0,0,0,0.7)',
    iconColor: '#000000',
    icon: 'key-outline',
  },
  {
    bg: '#FF0033', // Crimson Red
    title: 'ABSOLUTE ISOLATION',
    subtitle: 'SYS.AUTH // PROTOCOL',
    desc: 'Write this sequence on physical medium. Do not screenshot. Do not store digitally. Maintain absolute air-gapped isolation.',
    titleColor: '#FFFFFF',
    descColor: 'rgba(255,255,255,0.9)',
    iconColor: '#FFFFFF',
    icon: 'shield-half-outline',
  },
];

const SPRING_CONFIG = {
  damping: 18,
  stiffness: 100,
  mass: 1,
};

const DynamicEmblem = ({ icon, color, index }: { icon: string, color: string, index: number }) => {
  const rotAnim = useSharedValue(0);
  const pulseAnim = useSharedValue(1);
  const rippleAnim = useSharedValue(0);

  React.useEffect(() => {
    rotAnim.value = withRepeat(withTiming(360, { duration: 15000, easing: Easing.linear }), -1, false);
    pulseAnim.value = withRepeat(withTiming(1.2, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    rippleAnim.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }), -1, false);
  }, []);

  const spin1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotAnim.value}deg` }] }));
  const spin2 = useAnimatedStyle(() => ({ transform: [{ rotate: `-${rotAnim.value * 1.5}deg` }] }));
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  
  // Quantum Orbits (Slide 0)
  const qRing1 = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotAnim.value}deg` }, { rotateX: '65deg' }] }));
  const qRing2 = useAnimatedStyle(() => ({ transform: [{ rotateZ: `-${rotAnim.value}deg` }, { rotateY: '65deg' }] }));
  
  // Matrix Diamonds (Slide 1)
  const mBox1 = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotAnim.value}deg` }, { scale: pulseAnim.value }] }));
  const mBox2 = useAnimatedStyle(() => ({ transform: [{ rotateZ: `-${rotAnim.value * 0.8}deg` }] }));
  
  // Radar Shield (Slide 2)
  const rRipple1 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + rippleAnim.value * 1.5 }], opacity: 1 - rippleAnim.value }));
  const rRipple2 = useAnimatedStyle(() => ({ transform: [{ scale: 1 + ((rippleAnim.value + 0.5) % 1) * 1.5 }], opacity: 1 - ((rippleAnim.value + 0.5) % 1) }));

  if (index === 0) {
    return (
      <View style={styles.emblemWrapper}>
        <View style={[styles.emblemGlow, { backgroundColor: color, shadowColor: color, opacity: 0.3 }]} />
        {/* Quantum Orbits */}
        <Animated.View style={[styles.qRing, { borderColor: color }, qRing1]} />
        <Animated.View style={[styles.qRing, { borderColor: color }, qRing2]} />
        <Animated.View style={[styles.emblemRingInner, { width: 80, height: 80, borderColor: color, opacity: 0.8, borderLeftColor: 'transparent', borderRightColor: 'transparent' }, spin1]} />
        <Animated.View style={pulse}>
          <Ionicons name={icon as any} size={54} color={color} />
        </Animated.View>
      </View>
    );
  }

  if (index === 1) {
    return (
      <View style={styles.emblemWrapper}>
        {/* Matrix Diamonds */}
        <Animated.View style={[styles.mBox, { borderColor: color, borderStyle: 'dotted' }, mBox2]} />
        <Animated.View style={[styles.mBox, { width: 90, height: 90, borderColor: color, opacity: 0.5 }, mBox1]} />
        <Animated.View style={pulse}>
          <Ionicons name={icon as any} size={48} color={color} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.emblemWrapper}>
      {/* Radar Shield */}
      <Animated.View style={[styles.rRipple, { borderColor: color }, rRipple1]} />
      <Animated.View style={[styles.rRipple, { borderColor: color }, rRipple2]} />
      <Animated.View style={[styles.rSolidRing, { borderColor: color }, spin1]} />
      <Animated.View style={[pulse]}>
        <Ionicons name={icon as any} size={46} color={color} />
      </Animated.View>
    </View>
  );
};

export default function PhraseIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  
  const progress = useSharedValue(0);

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      const next = activeIndex + 1;
      setActiveIndex(next);
      progress.value = withSpring(next, SPRING_CONFIG);
      hapticTouch();
    } else {
      hapticSuccess();
      router.replace('/auth/recovery-phrase');
    }
  };

  const goBack = () => {
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      setActiveIndex(prev);
      progress.value = withSpring(prev, SPRING_CONFIG);
      hapticTouch();
    }
  };

  const updateStateOnJS = (nextIndex: number) => {
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
      hapticTouch();
    }
  };

  // Interactive Pan Gesture for scrubbing the liquid transition
  const pan = Gesture.Pan()
    .onChange((event) => {
      // Calculate delta based on horizontal drag (swipe left = next)
      const delta = -(event.changeX) / (SW * 0.5);
      const target = Math.max(0, Math.min(SLIDES.length - 1, activeIndex + delta));
      progress.value = target;
    })
    .onEnd((event) => {
      // Snap to nearest whole index
      const velocity = -event.velocityX;
      let nextIndex = activeIndex;
      
      if (velocity > 500 || progress.value > activeIndex + 0.3) {
        nextIndex = Math.min(SLIDES.length - 1, activeIndex + 1);
      } else if (velocity < -500 || progress.value < activeIndex - 0.3) {
        nextIndex = Math.max(0, activeIndex - 1);
      }
      
      progress.value = withSpring(nextIndex, SPRING_CONFIG);
      runOnJS(updateStateOnJS)(nextIndex);
    });

  // Dynamic button styles
  const btnStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      progress.value,
      [0, 1, 2],
      ['#00F0FF', '#000000', '#000000']
    );
    const textColor = interpolateColor(
      progress.value,
      [0, 1, 2],
      ['#000000', '#00F0FF', '#FFFFFF']
    );
    return {
      backgroundColor: bgColor,
      color: textColor,
      transform: [{ scale: interpolate(progress.value % 1, [0, 0.5, 1], [1, 0.9, 1]) }],
    };
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={pan}>
        <View style={styles.root}>
          
          {/* Base Background (Slide 0) */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: SLIDES[0]?.bg || '#000' }]} />

          {/* Liquid Ripple Backgrounds */}
          {[1, 2].map((i) => {
            const rippleStyle = useAnimatedStyle(() => {
              // The ripple starts growing when progress crosses i-1
              // At progress = i, it is fully scaled to 1.
              const scale = interpolate(progress.value, [i - 1, i], [0, 1], Extrapolation.CLAMP);
              return {
                transform: [{ scale }],
              };
            });

            return (
              <Animated.View
                key={`ripple-${i}`}
                style={[
                  styles.ripple,
                  { backgroundColor: SLIDES[i]?.bg || '#000' },
                  rippleStyle,
                ]}
              />
            );
          })}

          {/* Foreground Content */}
          <View style={[styles.contentWrap, { paddingTop: (insets?.top || 0) + 80, paddingBottom: (insets?.bottom || 0) + 120 }]} pointerEvents="box-none">
            {SLIDES.map((slide, i) => {
              const contentStyle = useAnimatedStyle(() => {
                const dist = progress.value - i;
                
                // Opacity fades out heavily when distance increases
                const opacity = interpolate(Math.abs(dist), [0, 0.5, 1], [1, 0, 0], Extrapolation.CLAMP);
                
                // Cinematic Entry: Slides come from the bottom, exit to the top
                const translateY = interpolate(dist, [-1, 0, 1], [100, 0, -100], Extrapolation.CLAMP);
                
                // Slight rotate for dynamic entry
                const rotate = interpolate(dist, [-1, 0, 1], [10, 0, -10], Extrapolation.CLAMP);

                return {
                  opacity,
                  transform: [{ translateY }, { rotate: `${rotate}deg` }],
                  position: 'absolute',
                  top: (insets?.top || 0) + 80,
                  left: 32,
                  right: 32,
                  pointerEvents: Math.abs(dist) < 0.5 ? 'auto' : 'none',
                };
              });

              return (
                <Animated.View key={`content-${i}`} style={contentStyle}>
                  {/* Sci-Fi Dynamic Emblem */}
                  <DynamicEmblem icon={slide.icon} color={slide.iconColor} index={i} />
                  
                  <View style={styles.textBlock}>
                    <Text style={[styles.subtitle, { color: slide.titleColor }]}>{slide.subtitle}</Text>
                    <Text style={[styles.title, { color: slide.titleColor }]}>{slide.title}</Text>
                    <Text style={[styles.desc, { color: slide.descColor }]}>{slide.desc}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Custom Footer Tracker & Button */}
          <View style={[styles.footer, { paddingBottom: (insets?.bottom || 0) + 30 }]} pointerEvents="box-none">
            {/* Progress Trackers */}
            <View style={styles.trackerWrap}>
              {[0, 1, 2].map((i) => {
                const lineStyle = useAnimatedStyle(() => {
                  const isActive = Math.abs(progress.value - i) < 0.5;
                  const width = withSpring(isActive ? 32 : 8, SPRING_CONFIG);
                  const opacity = withSpring(isActive ? 1 : 0.3, SPRING_CONFIG);
                  const bgColor = interpolateColor(
                    progress.value,
                    [0, 1, 2],
                    ['#00F0FF', '#000000', '#FFFFFF']
                  );
                  return { width, opacity, backgroundColor: bgColor };
                });
                return <Animated.View key={`tracker-${i}`} style={[styles.trackerLine, lineStyle]} />;
              })}
            </View>

            {/* Next / Genesis Button */}
            <Pressable onPress={goNext} style={{ width: '100%' }}>
              <Animated.View style={[styles.actionButton, btnStyle]}>
                <Text style={[styles.actionText, { color: activeIndex === 1 ? '#00F0FF' : (activeIndex === 2 ? '#FF0033' : '#000000') }]}>
                  {activeIndex === 2 ? 'INITIATE GENESIS' : 'TAP TO PROCEED'}
                </Text>
              </Animated.View>
            </Pressable>
          </View>

          {/* Invisible tap zones for explicit side tapping if desired */}
          <Pressable style={[styles.tapZone, { left: 0 }]} onPress={goBack} />
          <Pressable style={[styles.tapZone, { right: 0 }]} onPress={goNext} />

        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  ripple: {
    position: 'absolute',
    // Center the ripple roughly where the button is
    left: SW / 2 - SIZE / 2,
    top: SH * 0.85 - SIZE / 2,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  contentWrap: {
    flex: 1,
    zIndex: 2,
  },
  emblemWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  emblemGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
    elevation: 20,
  },
  emblemRingOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.3,
  },
  emblemRingInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    opacity: 0.6,
  },
  qRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  mBox: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderWidth: 2,
    opacity: 0.8,
  },
  rRipple: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
  rSolidRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderStyle: 'dashed',
    opacity: 0.9,
  },
  textBlock: {
    width: '100%',
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 50,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    marginBottom: 24,
  },
  desc: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
    paddingRight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  trackerWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 30,
    alignItems: 'center',
    height: 4,
  },
  trackerLine: {
    height: 3,
    borderRadius: 1.5,
  },
  actionButton: {
    width: '100%',
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  actionText: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 3,
    fontWeight: '900',
  },
  tapZone: {
    position: 'absolute',
    top: SH * 0.2,
    bottom: SH * 0.2,
    width: 60,
    zIndex: 5,
  },
});
