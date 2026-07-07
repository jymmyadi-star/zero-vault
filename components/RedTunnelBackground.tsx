import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

function Ridge({ top, left, right, bottom, size, rot, border, borderColor, color1, isRight }: any) {
  const circleSize = width * size;
  return (
    <View style={{
      position: 'absolute',
      top, left, right, bottom,
      width: circleSize, height: circleSize,
      borderRadius: circleSize / 2,
      borderRightWidth: isRight ? 0 : border,
      borderLeftWidth: isRight ? border : 0,
      borderColor: borderColor || 'transparent',
      transform: [{ rotate: rot }],
      overflow: 'hidden'
    }}>
      <LinearGradient
        colors={[isRight ? color1 : 'transparent', isRight ? 'transparent' : color1]}
        start={isRight ? { x: 0, y: 0 } : { x: 0.8, y: 0 }}
        end={isRight ? { x: 0.2, y: 0 } : { x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

export function RedTunnelBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={['#0F0000', '#000000', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.8 }}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Deep Background Glow */}
      <Ridge top={-height * 0.2} left={-width * 1.5} size={3} rot="0deg" border={0} color1="rgba(80,0,0,0.4)" />
      
      {/* The Grand Arc 1 */}
      <Ridge top={-height * 0.3} left={-width * 1.2} size={2.5} rot="15deg" border={1} borderColor="#FF1A1A" color1="rgba(255,0,0,0.5)" />
      
      {/* The Grand Arc 2 (Closer) */}
      <Ridge top={0} left={-width * 1.0} size={2.2} rot="25deg" border={2} borderColor="#FF4D4D" color1="rgba(255,0,0,0.7)" />
      
      {/* The Core Arc (Very sharp, very bright) */}
      <Ridge top={height * 0.2} left={-width * 0.8} size={1.8} rot="35deg" border={3} borderColor="#FFFFFF" color1="rgba(255,30,30,0.9)" />
      
      {/* Right Side Counter-Arc (Creates the tunnel perspective) */}
      <Ridge top={height * 0.5} right={-width * 1.2} size={2.0} rot="-20deg" border={2} borderColor="#FF8888" color1="rgba(255,0,0,0.6)" isRight={true} />

      {/* A final foreground sharp slice to add depth */}
      <Ridge top={height * 0.7} left={-width * 0.2} size={1.2} rot="50deg" border={1.5} borderColor="#FFAAAA" color1="rgba(255,0,0,0.8)" />

      <View style={styles.darkenOverlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  darkenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
