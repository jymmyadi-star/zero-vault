import React, { useRef, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';
import { BlurView } from 'expo-blur';
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

function TabButton({ route, isFocused, onPress, tab }: any) {
  const animValue = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: isFocused ? 1 : 0,
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true, // No more layout thrashing!
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

  return (
    <View style={[styles.tabContainer, { flex: isFocused ? 2.5 : 1 }]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={styles.tabTouch}
      >
        <Animated.View style={[styles.activeBackground, { opacity: bgOpacity }]} />
        
        <Animated.View style={{ transform: [{ translateY }, { scale: iconScale }] }}>
          <Ionicons
            name={(tab.icon + (isFocused ? '' : '-outline')) as any}
            size={24}
            color={isFocused ? '#FFFFFF' : '#8E8E93'}
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
      <BlurView intensity={90} tint="dark" style={styles.blur}>
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
  blur: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 36,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(18, 18, 20, 0.85)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  labelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
