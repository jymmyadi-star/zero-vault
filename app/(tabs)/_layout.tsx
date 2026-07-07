import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hapticTouch } from '../../lib/haptics';

const { width } = Dimensions.get('window');
const TAB_BAR_MARGIN = 20;
const INACTIVE_FLEX = 1;
const ACTIVE_FLEX = 2.5;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { name: 'index', title: 'Passwords', icon: 'key' },
  { name: 'seeds', title: 'Seeds', icon: 'leaf' },
  { name: 'notes', title: 'Notes', icon: 'document-text' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
] as const;

import Svg, { LinearGradient as SvgLinearGradient, RadialGradient, Stop, Rect, Defs } from 'react-native-svg';

function TabButton({ route, isFocused, onPress, tab }: any) {
  const animValue = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isFocused ? 1 : 0,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const iconScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const bgOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const uniqueId = tab.name;

  return (
    <View style={[styles.tabContainer, { flex: isFocused ? 2.5 : 1 }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.tabTouch}
      >
        {/* Volumetric Glass Background (White U-Shape, native gradients) */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: bgOpacity, borderRadius: 24, overflow: 'hidden' }]}>
          {/* Layer 1: Black Core */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050002' }]} />
          {/* Layer 2: White glow pooling at the bottom */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.45)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* Layer 2b: Black valley pushing glow into U-shape */}
          <LinearGradient
            colors={['rgba(5,0,2,1)', 'rgba(5,0,2,0.95)', 'rgba(5,0,2,0)']}
            locations={[0, 0.4, 0.75]}
            style={StyleSheet.absoluteFill}
          />
          {/* Layer 3: Outer Glass Edge */}
          <View style={[StyleSheet.absoluteFillObject, {
            borderRadius: 24,
            borderBottomWidth: 1.5,
            borderLeftWidth: 0.5,
            borderRightWidth: 0.5,
            borderTopWidth: 0.2,
            borderColor: '#FFFFFF',
            opacity: 0.12,
          }]} />
        </Animated.View>
        
        <Animated.View style={{ transform: [{ translateY }, { scale: iconScale }] }}>
          <Ionicons
            name={(tab.icon + (isFocused ? '' : '-outline')) as any}
            size={24}
            color={isFocused ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
          />
        </Animated.View>
        
        {isFocused && (
          <Animated.View style={{ opacity: bgOpacity, overflow: 'hidden', marginLeft: 6 }}>
            <Text style={styles.labelActive} numberOfLines={1}>
              {tab.title}
            </Text>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FloatingTabBar({ state, navigation }: any) {
  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <LinearGradient colors={['rgba(3, 0, 2, 0.95)', '#030002']} style={StyleSheet.absoluteFill} />
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tab = TABS[index];
          if (!tab) return null;

          const onPress = () => {
            hapticTouch();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              // Trigger layout animation natively before state change
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              navigation.navigate(route.name);
            }
          };

          return (
            <TabButton 
              key={route.key} 
              route={route} 
              isFocused={isFocused} 
              onPress={onPress} 
              tab={tab} 
            />
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="seeds" />
      <Tabs.Screen name="notes" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    zIndex: 100,
  },
  tabGradientBorder: {
    borderRadius: 36,
    padding: 1,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    height: 68,
    paddingHorizontal: 8,
  },
  tabContainer: {
    height: '100%',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tabTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: '100%',
    borderRadius: 24,
  },
  activeBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
