import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, StyleProp, ViewStyle } from 'react-native';
import Svg, { LinearGradient, RadialGradient, Stop, Rect, Ellipse, Path, Defs } from 'react-native-svg';

interface LiquidGlassButtonProps {
  title: string;
  icon?: React.ReactNode;
  onPress: () => void;
  width?: number;
  height?: number;
  color?: string; // Base liquid color (e.g., #FF0033)
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassButton({
  title,
  icon,
  onPress,
  width = 240,
  height = 70,
  color = '#FF0033',
  style,
}: LiquidGlassButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.92, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.7, duration: 300, useNativeDriver: true })
    ]).start();
  };

  // Ultra-smooth squircle radius
  const borderRadius = height * 0.4;

  return (
    <Pressable 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[{ width, height, alignSelf: 'center' }, style]}
    >
      <Animated.View style={[
        styles.container,
        { 
          width, 
          height, 
          borderRadius,
          transform: [{ scale: scaleAnim }]
        }
      ]}>
        
        {/* Layer 1: Absolute Black Core */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000', borderRadius }]} />

        {/* Layer 2: The Liquid Volumetric Glow (Concave arc — smile curve) */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glowAnim, borderRadius, overflow: 'hidden' }]}>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="liquidGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={color} stopOpacity="0" />
                <Stop offset="50%" stopColor={color} stopOpacity="0" />
                <Stop offset="70%" stopColor={color} stopOpacity="0.05" />
                <Stop offset="85%" stopColor={color} stopOpacity="0.4" />
                <Stop offset="100%" stopColor={color} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Path 
              d={`M0,${height * 0.5} Q${width * 0.5},${height * 0.95} ${width},${height * 0.5} L${width},${height} L0,${height} Z`}
              fill="url(#liquidGradient)"
            />
          </Svg>
        </Animated.View>

        {/* Layer 3: Inner Rim Light (Side + Bottom contours raised) */}
        <View style={[StyleSheet.absoluteFillObject, { 
          borderRadius, 
          borderBottomWidth: 2, 
          borderLeftWidth: 1.5, 
          borderRightWidth: 1.5, 
          borderTopWidth: 0.3,
          borderColor: color, 
          opacity: 0.35,
        }]} />

        {/* Layer 3.5: Inner Ambient Depth (radial vignette) */}
        <View style={[StyleSheet.absoluteFillObject, { borderRadius, overflow: 'hidden' }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="innerDepth" cx="50%" cy="70%" rx="70%" ry="60%">
                <Stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#innerDepth)" />
          </Svg>
        </View>

        {/* Layer 4: Glass Dome Specular Highlight (Top Reflection) */}
        <View style={[StyleSheet.absoluteFillObject, { borderRadius, overflow: 'hidden' }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="glassReflection" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                <Stop offset="15%" stopColor="#FFFFFF" stopOpacity="0.15" />
                <Stop offset="35%" stopColor="#FFFFFF" stopOpacity="0.03" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            {/* Wide, shallow dome — mimics real glass curvature */}
            <Ellipse 
              cx={width / 2} 
              cy={-height * 0.35} 
              rx={width * 0.7} 
              ry={height * 0.85} 
              fill="url(#glassReflection)" 
            />
          </Svg>
        </View>

        {/* Layer 5: Content */}
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.text, { color: '#FFFFFF', textShadowColor: color }]}>
            {title}
          </Text>
        </View>

      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    // Drop shadow with a crimson tint for the floating liquid glow
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 10, // Ensure content is above the glass reflection
  },
  iconWrapper: {
    opacity: 0.9,
  },
  text: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10, // Makes the text gently glow with the liquid color
  }
});
