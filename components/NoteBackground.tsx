import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, RadialGradient, Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle) as any;

const { width, height } = Dimensions.get('window');

export function NoteBackground() {
  const breathAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathAnim, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathAnim, { toValue: 0.6, duration: 6000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={styles.root} pointerEvents="none">
      {/* Deepest Violet Void (Almost Pitch Black) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#020004' }]} />
      
      <Svg width={width} height={height}>
        <Defs>
          {/* The singular crimson thread fade */}
          <LinearGradient id="crimsonArcFade" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.6" />
            <Stop offset="40%" stopColor="#FF0033" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>

          {/* Crimson atmospheric dust, giving weight to the void */}
          <RadialGradient id="crimsonGlow" cx="70%" cy="80%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.05" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Ambient indigo wash in the lower right */}
        <AnimatedCircle 
          cx={width * 0.7} 
          cy={height * 0.8} 
          r={width * 0.7} 
          fill="url(#crimsonGlow)" 
          style={{ opacity: breathAnim }}
        />

        {/* The Crimson Arc */}
        <Path 
          d={`M${-width * 0.2},${-height * 0.1} Q${width * 0.5},${height * 0.3} ${width * 1.2},${height * 1.1}`} 
          stroke="url(#crimsonArcFade)" 
          strokeWidth="1.5" 
          strokeLinecap="round"
          fill="none" 
        />
        
        {/* A microscopic twin-line to give the stroke architectural precision */}
        <Path 
          d={`M${-width * 0.18},${-height * 0.1} Q${width * 0.52},${height * 0.3} ${width * 1.22},${height * 1.1}`} 
          stroke="#FF0033" 
          strokeWidth="0.3" 
          strokeOpacity="0.2"
          strokeLinecap="round"
          fill="none" 
        />
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
