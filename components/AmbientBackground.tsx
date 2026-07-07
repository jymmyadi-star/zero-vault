import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

export function AmbientBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      {/* Base deep void */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#020002' }]} />
      
      <Svg width={width} height={height}>
        <Defs>
          {/* Deep, almost black gradients for the monolith surfaces */}
          <LinearGradient id="monolithSurface1" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#0A0002" stopOpacity="1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="monolithSurface2" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#140005" stopOpacity="1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="monolithSurface3" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0%" stopColor="#080002" stopOpacity="1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="1" />
          </LinearGradient>

          {/* Sharp, cinematic crimson lighting for the edges */}
          <LinearGradient id="edgeLightPrimary" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.8" />
            <Stop offset="40%" stopColor="#FF0033" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="edgeLightSecondary" x1="1" y1="1" x2="0" y2="0">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.4" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="edgeLightHighlight" x1="0" y1="0.5" x2="1" y2="0.5">
            <Stop offset="0%" stopColor="#FF0033" stopOpacity="0.3" />
            <Stop offset="30%" stopColor="#FF0033" stopOpacity="0.1" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* 1. The Titan Shard (Background Left-to-Right) */}
        <Path 
          d={`M${-width * 0.3},${-height * 0.1} L${width * 0.9},${height * 0.4} L${width * 0.7},${height * 1.2} L${-width * 0.5},${height * 0.8} Z`} 
          fill="url(#monolithSurface1)" 
        />
        {/* Cinematic Rim Light for Titan Shard */}
        <Path 
          d={`M${-width * 0.3},${-height * 0.1} L${width * 0.9},${height * 0.4}`} 
          stroke="url(#edgeLightPrimary)" 
          strokeWidth="1.5" 
          fill="none" 
        />

        {/* 2. The Obelisk (Right side, vertical slice) */}
        <Path 
          d={`M${width * 0.6},${-height * 0.2} L${width * 1.5},${height * 0.1} L${width * 0.8},${height * 1.3} L${width * 0.1},${height * 1.1} Z`} 
          fill="url(#monolithSurface2)" 
        />
        {/* Cinematic Rim Light for Obelisk */}
        <Path 
          d={`M${width * 0.6},${-height * 0.2} L${width * 0.1},${height * 1.1}`} 
          stroke="url(#edgeLightSecondary)" 
          strokeWidth="1" 
          fill="none" 
        />

        {/* 3. The Singularity Blade (Sharp thin diagonal cutting the center) */}
        <Path 
          d={`M${-width * 0.2},${height * 0.8} L${width * 1.2},${height * 0.5} L${width * 1.3},${height * 0.55} L${-width * 0.1},${height * 0.85} Z`} 
          fill="url(#monolithSurface3)" 
        />
        {/* Bright specular highlight on the blade edge (softened) */}
        <Path 
          d={`M${-width * 0.2},${height * 0.8} L${width * 1.2},${height * 0.5}`} 
          stroke="url(#edgeLightHighlight)" 
          strokeWidth="1" 
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
