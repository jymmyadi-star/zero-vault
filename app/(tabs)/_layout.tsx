import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { hapticTouch } from '../../lib/haptics';

const { width } = Dimensions.get('window');
const TAB_BAR_MARGIN = 20;
const TAB_BAR_WIDTH = width - (TAB_BAR_MARGIN * 2);
const TAB_WIDTH = TAB_BAR_WIDTH / 4;

const TABS = [
  { name: 'index', title: 'Passwords', icon: 'key' },
  { name: 'seeds', title: 'Seeds', icon: 'leaf' },
  { name: 'notes', title: 'Notes', icon: 'document-text' },
  { name: 'settings', title: 'Settings', icon: 'settings' },
] as const;

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const animatedValue = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: state.index,
      useNativeDriver: true,
      damping: 15,
      stiffness: 140,
      mass: 0.8,
    }).start();
  }, [state.index]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1, 2, 3],
    outputRange: [0, TAB_WIDTH, TAB_WIDTH * 2, TAB_WIDTH * 3],
  });

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="dark" style={styles.blur}>
        {/* Animated Sliding Pill Background */}
        <Animated.View 
          style={[
            styles.slidingPill,
            { transform: [{ translateX }] }
          ]} 
        />

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
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={styles.tab}
            >
              <Ionicons
                name={(tab.icon + (isFocused ? '' : '-outline')) as any}
                size={22}
                color={isFocused ? '#FFFFFF' : '#8E8E93'}
              />
              <Text style={[styles.label, isFocused && styles.labelActive]}>
                {tab.title}
              </Text>
            </TouchableOpacity>
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
    alignItems: 'center',
    zIndex: 100,
  },
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    backgroundColor: 'rgba(18, 18, 20, 0.82)',
  },
  slidingPill: {
    position: 'absolute',
    width: TAB_WIDTH - 12,
    height: 48,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    top: 8,
    left: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8E8E93',
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
