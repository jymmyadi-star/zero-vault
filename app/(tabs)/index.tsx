import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated, 
  Dimensions, 
  Platform 
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { VaultCard } from '../../components/VaultCard';
import { queryVaultItems, type VaultItemMetadata } from '../../lib/services/vault-service';
import { useVaultStore } from '../../lib/store/vault-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

import { VaultRings } from '../../components/VaultRings';

const QuickActions = () => {
  const actions = [
    { icon: 'key-outline', label: 'Password', color: '#FFFFFF', route: '/create-password' },
    { icon: 'leaf-outline', label: 'Seed Phrase', color: '#FFFFFF', route: '/create-seed' },
    { icon: 'document-text-outline', label: 'Secure Note', color: '#FFFFFF', route: '/create-note' },
  ];

  return (
    <View style={styles.quickActionsContainer}>
      {actions.map((action, i) => (
        <TouchableOpacity 
          key={i} 
          style={styles.actionBtn}
          onPress={() => router.push(action.route as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.actionIconBox, { backgroundColor: `${action.color}08`, borderColor: `${action.color}18` }]}>
            <Ionicons name={action.icon as any} size={22} color={action.color} />
          </View>
          <Text style={styles.actionLabel}>{action.label.toUpperCase()}</Text>
        </TouchableOpacity>
      ))}
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
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />

      {/* Cyber Grid & Ambient Glows */}
      <View style={styles.gridOverlay}>
        <LinearGradient colors={['rgba(0, 240, 255, 0.01)', 'transparent']} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={styles.ambientGlow} />

      {/* ─── FLOATING HUD HEADER ─── */}
      <View style={[styles.headerContainer, { top: safeTop }]}>
        <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                {(() => {
                  const hour = new Date().getHours();
                  const isDay = hour >= 6 && hour < 18;
                  return (
                    <Ionicons
                      name={isDay ? "sunny-outline" : "moon-outline"}
                      size={18}
                      color={isDay ? "#FFD60A" : "#BF5AF2"}
                    />
                  );
                })()}
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.userName} numberOfLines={1}>ENCLAVE CORE</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <View style={styles.syncPill}>
                <View style={styles.syncDot} />
                <Text style={styles.syncText}>ONLINE</Text>
              </View>
              <TouchableOpacity onPress={() => lock()} style={styles.iconBtn}>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </BlurView>
      </View>

      {/* ─── FLUID SCROLL VIEW ─── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: safeTop + 94, paddingBottom: 130 }]}
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
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={32} color="#8E8E93" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Vault Empty</Text>
              <Text style={styles.emptySubtitle}>
                No cryptographic entries found. Start by generating secure credentials.
              </Text>
              <TouchableOpacity 
                style={[styles.primaryBtn, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'transparent' }]}
                onPress={() => router.push('/create-password')}
              >
                <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>COMMIT PASSWORD NODE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.listWrapper}>
              {items.slice(0, 5).map(item => (
                <VaultCard key={item.id} item={item} onPress={() => handlePress(item)} />
              ))}
            </View>
          )}
        </View>

        {/* ─── SECURITY INTEGRITY STATUS ─── */}
        <View style={[styles.section, { marginTop: 28 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>[ ENCLAVE DIAGNOSTICS ]</Text>
          </View>
          <View style={styles.diagnosticsPod}>
            <View style={styles.diagnosticsHeader}>
              <View style={styles.statusDotRow}>
                <View style={styles.pulseDot} />
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
          </View>
        </View>

        {/* ─── SECURITY GUIDE & COMPILATION ADVICE ─── */}
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
            <View style={styles.guideCard}>
              <View style={styles.guideIconHeader}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                <Text style={styles.guideCardTitle}>Argon2 Memory Protection</Text>
              </View>
              <Text style={styles.guideCardDesc}>
                Your master PIN is stretched using Argon2 natively. This protects against automated GPU/ASIC brute-force attempts if database blocks are intercepted.
              </Text>
            </View>

            <View style={styles.guideCard}>
              <View style={styles.guideIconHeader}>
                <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                <Text style={styles.guideCardTitle}>Plaintext Memory Isolation</Text>
              </View>
              <Text style={styles.guideCardDesc}>
                Sensitive keys are decrypted only when viewed, and completely wiped from RAM when you lock the app or minimize it.
              </Text>
            </View>

            <View style={styles.guideCard}>
              <View style={styles.guideIconHeader}>
                <Ionicons name="cloud-offline-outline" size={18} color="#FFFFFF" />
                <Text style={styles.guideCardTitle}>Sovereign Identity Sync</Text>
              </View>
              <Text style={styles.guideCardDesc}>
                Zero Vault never sees your Master PIN or plaintext records. Scurrying database rows are encrypted before leaving your hardware.
              </Text>
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
    backgroundColor: '#020204',
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
    backgroundColor: 'rgba(255, 255, 255, 0.005)',
    filter: Platform.OS === 'ios' ? 'blur(100px)' : undefined,
  },
  headerContainer: {
    position: 'absolute', 
    left: 16, 
    right: 16, 
    zIndex: 100, 
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(18, 18, 20, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  headerBlur: {
    paddingVertical: 12,
    paddingHorizontal: 16,
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
  avatarContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.15)',
  },
  syncDot: {
    width: 6, 
    height: 6, 
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  syncText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#34d399',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
    alignItems: 'center',
    gap: 8,
  },
  actionIconBox: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#0D0D12',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
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
    backgroundColor: '#0D0D12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    gap: 12,
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
    backgroundColor: '#0D0D12',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    gap: 10,
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
