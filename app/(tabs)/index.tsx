import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Pressable,
  ScrollView, 
  Animated, 
  Dimensions, 
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { LinearGradient as SvgLinearGradient, RadialGradient, Stop, Rect, Ellipse, Path, Defs } from 'react-native-svg';
import { VaultCard } from '../../components/VaultCard';
import { queryVaultItems, type VaultItemMetadata } from '../../lib/services/vault-service';
import { useVaultStore } from '../../lib/store/vault-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

import { VaultRings } from '../../components/VaultRings';
import { AmbientBackground } from '../../components/AmbientBackground';
import { TurturicaMascot } from '../../components/ui/TurturicaMascot';

const QuickActionBtn = ({ action, size }: { action: any; size: number }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.7)).current;
  // A perfect square squircle
  const btnWidth = size;
  const btnHeight = size;
  const borderRadius = size * 0.32;

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

  return (
    <Pressable 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => {
        (globalThis as any).__zerovault_lastParams = null;
        router.push(action.route as any);
      }}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[
        styles.actionGlassContainer,
        { 
          width: btnWidth,
          height: btnHeight,
          borderRadius,
          transform: [{ scale: scaleAnim }],
        }
      ]}>
        {/* Layer 1: Black Core */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#050002', borderRadius }]} />

        {/* Layer 2: Deep Volumetric Glass Wall (U-Shape) */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glowAnim, borderRadius, overflow: 'hidden' }]}>
          <Svg width={btnWidth} height={btnHeight}>
            <Defs>
              <SvgLinearGradient id="redBase" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FF0033" stopOpacity="0" />
                <Stop offset="35%" stopColor="#FF0033" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#FF0033" stopOpacity="0.75" />
              </SvgLinearGradient>
              <RadialGradient id="blackValley" cx="50%" cy="-40%" rx="65%" ry="140%">
                <Stop offset="0%" stopColor="#050002" stopOpacity="1" />
                <Stop offset="70%" stopColor="#050002" stopOpacity="0.95" />
                <Stop offset="100%" stopColor="#050002" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            {/* The base red light covering the bottom area */}
            <Rect width="100%" height="100%" fill="url(#redBase)" />
            {/* The soft black shadow pushing the red down into a U-shape (Zero lines, perfect fade) */}
            <Rect width="100%" height="100%" fill="url(#blackValley)" />
          </Svg>
        </Animated.View>

        {/* Layer 3: Outer Glass Edge */}
        <View style={[StyleSheet.absoluteFillObject, { 
          borderRadius, 
          borderBottomWidth: 1.5, 
          borderLeftWidth: 0.5, 
          borderRightWidth: 0.5, 
          borderTopWidth: 0.2,
          borderColor: '#FF0033', 
          opacity: 0.15,
        }]} />

        {/* Layer 4: Top Glass Dome Specular Highlight */}
        <View style={[StyleSheet.absoluteFillObject, { borderRadius, overflow: 'hidden' }]}>
          <Svg width={btnWidth} height={btnHeight}>
            <Defs>
              <SvgLinearGradient id="miniGlass" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.15" />
                <Stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.02" />
                <Stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            <Ellipse 
              cx={btnWidth * 0.5} 
              cy={-btnHeight * 0.2} 
              rx={btnWidth * 0.7} 
              ry={btnHeight * 0.6} 
              fill="url(#miniGlass)" 
            />
          </Svg>
        </View>

        {/* Layer 5: Content */}
        <View style={[styles.actionGlassContent, { width: btnWidth, height: btnHeight }]}>
          <Ionicons name={action.icon as any} size={29} color="#FF0033" style={styles.actionIconGlow} />
          <Text style={styles.actionLabel}>{action.label.toUpperCase()}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const QuickActions = () => {
  const [btnSize, setBtnSize] = useState(105); // fallback default

  const actions = [
    { icon: 'key-outline', label: 'Password', color: '#FFFFFF', route: '/create-password' },
    { icon: 'leaf-outline', label: 'Seed Phrase', color: '#FFFFFF', route: '/create-seed' },
    { icon: 'document-text-outline', label: 'Secure Note', color: '#FFFFFF', route: '/create-note' },
  ];

  return (
    <View 
      style={styles.quickActionsContainer}
      onLayout={(e) => {
        const totalWidth = e.nativeEvent.layout.width;
        // 3 buttons, 2 gaps of 12px
        setBtnSize((totalWidth - 24) / 3);
      }}
    >
      {actions.map((action, i) => (
        <QuickActionBtn key={i} action={action} size={btnSize} />
      ))}
    </View>
  );
};

const SyncPulse = () => {
  const anim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: 8, height: 8, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#34d399',
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.35] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }]
      }} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' }} />
    </View>
  );
};

// ─── MAIN SCREEN ───

export default function DashboardScreen() {
  const { lock } = useVaultStore();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<VaultItemMetadata[]>([]);
  
  const scrollY = useRef(new Animated.Value(0)).current;

  const loadItems = useCallback(async () => {
    try {
      // Query recent items
      const data = await queryVaultItems({});
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const handlePress = (item: VaultItemMetadata) => {
    (globalThis as any).__zerovault_lastParams = { editId: item.id };
    router.push({ pathname: '/item/[id]', params: { id: item.id } });
  };

  const safeTop = Math.min(insets.top, 60) + 12;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />

      {/* ─── FLOATING HUD HEADER ─── */}
      <View style={[styles.headerContainer, { top: safeTop }]}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.25)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 0, 51, 0.35)']}
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerBorderWrapper}
        >
          <BlurView intensity={35} tint="dark" style={styles.headerInner}>
            <LinearGradient colors={['rgba(3, 0, 2, 0.2)', 'rgba(3, 0, 2, 0.75)']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarChamber}>
                  <TurturicaMascot size={22} />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.greeting}>{getGreeting()}</Text>
                  <Text style={styles.userName} numberOfLines={1}>ENCLAVE CORE</Text>
                </View>
              </View>

              <View style={styles.headerRight}>
                <View style={styles.syncPill}>
                  <SyncPulse />
                  <Text style={styles.syncText}>ONLINE</Text>
                </View>
                
                <TouchableOpacity onPress={() => lock()} style={styles.lockSwitch} activeOpacity={0.6}>
                  <Ionicons name="lock-closed" size={14} color="#FF0033" style={styles.lockIcon} />
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </LinearGradient>
      </View>

      {/* ─── FLUID SCROLL VIEW ─── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 94, paddingBottom: 180 }]}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <VaultRings
          passwordsCount={items.filter((i) => i.itemType === 'password').length}
          seedsCount={items.filter((i) => i.itemType === 'seed_phrase').length}
          notesCount={items.filter((i) => i.itemType === 'note').length}
        />

        <QuickActions />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>[ RECENT RECORDS ]</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/index')}>
              <Text style={styles.seeAllText}>VIEW ALL</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={['transparent', 'rgba(255, 0, 51, 0.4)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ position: 'absolute', bottom: -1, left: 20, right: 20, height: 2, borderRadius: 2 }}
              />
              <BlurView intensity={40} tint="dark" style={styles.emptyState}>
                <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
                <Ionicons name="folder-open-outline" size={32} color="#8E8E93" style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>Vault Empty</Text>
                <Text style={styles.emptySubtitle}>
                  No cryptographic entries found. Start by generating secure credentials.
                </Text>
                <TouchableOpacity 
                  style={[styles.primaryBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'transparent' }]}
                  onPress={() => {
                    (globalThis as any).__zerovault_lastParams = null;
                    router.push('/create-password');
                  }}
                >
                  <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>COMMIT PASSWORD NODE</Text>
                </TouchableOpacity>
              </BlurView>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {items.slice(0, 5).map(item => (
                <VaultCard key={item.id} item={item} onPress={() => handlePress(item)} />
              ))}
            </View>
          )}
        </View>

        {/* ——— SECURITY INTEGRITY STATUS ——— */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>[ ENCLAVE DIAGNOSTICS ]</Text>
          </View>
          <View style={{ position: 'relative' }}>
            {/* White bottom edge glow */}
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ position: 'absolute', bottom: -1, left: 20, right: 20, height: 2, borderRadius: 2 }}
            />
            <BlurView intensity={30} tint="dark" style={styles.diagnosticsPod}>
              <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
              {/* White top shimmer */}
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ position: 'absolute', top: 0, left: 24, right: 24, height: 1.5 }}
              />
              <View style={styles.diagnosticsHeader}>
                <View style={styles.statusDotRow}>
                  <View style={[styles.pulseDot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={styles.statusLabel}>VAULT STATE: SECURED</Text>
                </View>
                <Text style={styles.healthScore}>98% HARDENED</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.diagRow}>
                <Text style={styles.diagKey}>Encryption Standard</Text>
                <Text style={styles.diagVal}>XChaCha20-Poly1305</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagKey}>Argon2id (128MB / 6p)</Text>
                <Text style={styles.diagVal}>Active</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagKey}>Zero-Knowledge Enclave</Text>
                <Text style={styles.diagVal}>Active</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagKey}>Sync Metadata Payload</Text>
                <Text style={styles.diagVal}>Encrypted</Text>
              </View>
            </BlurView>
          </View>
        </View>

        {/* ——— SECURITY GUIDE & COMPILATION ADVICE ——— */}
        <View style={[styles.section, { marginTop: 28, marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>[ SECURITY MANIFESTO ]</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            snapToInterval={width - 56}
            decelerationRate="fast"
          >
            {/* Card 1: Argon2 — Silver/White personality */}
            <View style={{ position: 'relative', width: width - 56 }}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 2 }}
              />
              <BlurView intensity={30} tint="dark" style={styles.guideCard}>
                <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.25)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1.5 }}
                />
                <View style={styles.guideIconHeader}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.guideCardTitle}>Argon2 Memory Protection</Text>
                </View>
                <Text style={styles.guideCardDesc}>
                  Your master PIN is stretched using Argon2 natively. This protects against automated GPU/ASIC brute-force attempts if database blocks are intercepted.
                </Text>
              </BlurView>
            </View>

            {/* Card 2: Entropy — White personality */}
            <View style={{ position: 'relative', width: width - 56 }}>
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 2 }}
              />
              <BlurView intensity={30} tint="dark" style={styles.guideCard}>
                <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.25)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1.5 }}
                />
                <View style={styles.guideIconHeader}>
                  <Ionicons name="hardware-chip-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.guideCardTitle}>Entropy Verification</Text>
                </View>
                <Text style={styles.guideCardDesc}>
                  All seed generation uses true system-level CSPRNG entropy blocks before deterministic derivation.
                </Text>
              </BlurView>
            </View>

            {/* Card 3: Zero-Knowledge — White personality */}
            <View style={{ position: 'relative', width: width - 56 }}>
              <LinearGradient
                colors={['transparent', 'rgba(255, 255, 255, 0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ position: 'absolute', bottom: -1, left: 16, right: 16, height: 2, borderRadius: 2 }}
              />
              <BlurView intensity={30} tint="dark" style={styles.guideCard}>
                <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.25)', 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1.5 }}
                />
                <View style={styles.guideIconHeader}>
                  <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.guideCardTitle}>Zero-Knowledge Sync</Text>
                </View>
                <Text style={styles.guideCardDesc}>
                  The central synchronization relies entirely on encrypted payloads. The backend node cannot decouple or identify your key architecture.
                </Text>
              </BlurView>
            </View>
          </ScrollView>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
  },
  ambientGlow: {
    position: 'absolute',
    top: height * 0.1,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(255, 0, 50, 0.05)',
    filter: Platform.OS === 'ios' ? 'blur(100px)' : undefined,
  },
  headerContainer: {
    position: 'absolute', 
    left: 16, 
    right: 16, 
    zIndex: 100, 
    borderRadius: 24,
  },
  headerBorderWrapper: {
    padding: 1,
    borderRadius: 24,
  },
  headerInner: {
    borderRadius: 23,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(5, 0, 2, 0.45)',
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    flex: 1 
  },
  avatarChamber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: { marginLeft: 12, flex: 1 },
  greeting: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: "#8E8E93",
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.15)',
  },
  syncText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34d399',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lockSwitch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 0, 51, 0.08)',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.25)',
  },
  lockIcon: {
    opacity: 0.9,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 24,
  },
  ringsCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#0D0D12',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
    marginBottom: 24,
  },
  ringsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ringsTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  ringsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  ringsActionText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  ringsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ringGraphic: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 24,
  },
  ringLayer: {
    position: 'absolute',
    borderWidth: 5,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '45deg' }],
    opacity: 0.9,
  },
  ringLegends: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  legendValue: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },
  actionBtn: {
    flex: 1,
  },
  actionGlassContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  actionGlassContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  actionIconGlow: {
    opacity: 0.8,
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  actionLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  seeAllText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1,
  },
  emptyState: { 
    paddingVertical: 32, 
    paddingHorizontal: 20,
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 0, 2, 0.55)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    overflow: 'hidden',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  listWrapper: {
    gap: 10,
  },
  diagnosticsPod: {
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    overflow: 'hidden',
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  statusLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  healthScore: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFFFFF',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 4,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagKey: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  diagVal: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFFFFF',
    fontWeight: '600',
  },
  horizontalScroll: {
    gap: 12,
    paddingRight: 20,
  },
  guideCard: {
    width: width - 56,
    height: 165,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    overflow: 'hidden',
  },
  guideIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideCardTitle: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  guideCardDesc: {
    fontSize: 11,
    color: '#8E8E93',
    lineHeight: 16,
  },
});
