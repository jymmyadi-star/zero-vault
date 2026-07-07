import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Ellipse, Defs, LinearGradient, Stop, RadialGradient, Circle, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G) as any;

const { width, height } = Dimensions.get('window');

export function SeedBackground() {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();

    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 120000, // extremely slow 2-minute rotation
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.root} pointerEvents="none">
      {/* Absolute Void */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000000' }]} />
      
      <Svg width={width} height={height}>
        <Defs>
          {/* A slow, breathing fade for the singularity line (Crimson) */}
          <LinearGradient id="crimsonFade" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.4" />
            <Stop offset="30%" stopColor="#FF3333" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>

          {/* Deep atmospheric glow, nearly imperceptible */}
          <RadialGradient id="voidGlow" cx="30%" cy="20%" rx="70%" ry="70%">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.04" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Atmospheric presence (fills the upper left void gently) */}
        <Circle 
          cx={width * 0.3} 
          cy={height * 0.2} 
          r={width * 0.8} 
          fill="url(#voidGlow)" 
        />

        <AnimatedG style={{ 
          opacity: pulseAnim,
          transform: [
            { translateX: width / 2 },
            { translateY: height * 0.35 },
            { rotate: spin },
            { translateX: -width / 2 },
            { translateY: -height * 0.35 }
          ]
        }}>
          {/* The Crimson Singularity - One singular, perfect path */}
          {/* We tilt the ellipse for organic dynamism, while keeping it strictly minimalist */}
          <Ellipse 
            cx={width * 0.5} 
            cy={height * 0.35} 
            rx={width * 0.65} 
            ry={width * 0.35} 
            transform={`rotate(-25, ${width * 0.5}, ${height * 0.35})`}
            stroke="url(#crimsonFade)" 
            strokeWidth="1" 
            fill="none" 
          />
          
          {/* A subtle ghost echo of the ring to provide depth without clutter */}
          <Ellipse 
            cx={width * 0.5} 
            cy={height * 0.35} 
            rx={width * 0.67} 
            ry={width * 0.37} 
            transform={`rotate(-25, ${width * 0.5}, ${height * 0.35})`}
            stroke="#FF0033" 
            strokeWidth="0.3" 
            strokeOpacity="0.15"
            fill="none" 
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
