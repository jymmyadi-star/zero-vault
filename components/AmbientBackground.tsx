import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export function AmbientBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={['#0A0214', '#000000', '#000000']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.7 }}
        style={styles.base}
      />
      <View style={styles.core}>
        <LinearGradient
          colors={['#2D0B5E', '#140626', 'transparent']}
          start={{ x: 0.5, y: 0.2 }}
          end={{ x: 0.5, y: 0.75 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
      <View style={styles.accentR}>
        <LinearGradient
          colors={['rgba(100, 50, 180, 0.12)', 'transparent']}
          start={{ x: 0.8, y: 0 }}
          end={{ x: 0.2, y: 0.6 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  core: {
    position: 'absolute',
    top: height * 0.02,
    left: width * 0.08,
    right: width * 0.08,
    height: height * 0.45,
    borderRadius: height * 0.22,
    overflow: 'hidden',
    opacity: 0.75,
  },
  accentR: {
    position: 'absolute',
    top: -height * 0.08,
    right: -width * 0.12,
    width: width * 0.6,
    height: height * 0.4,
    borderRadius: height * 0.2,
    overflow: 'hidden',
  },
});
