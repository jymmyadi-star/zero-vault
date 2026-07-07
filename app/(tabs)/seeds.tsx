import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VaultCard } from '../../components/VaultCard';
import { LiquidGlassButton } from '../../components/LiquidGlassButton';
import { SeedBackground } from '../../components/SeedBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { queryVaultItems, type VaultItemMetadata } from '../../lib/services/vault-service';

const { width, height } = Dimensions.get('window');

const CinematicSeedsEmpty = () => {
  const spinAnim = useSharedValue(0);
  
  React.useEffect(() => {
    spinAnim.value = withRepeat(
      withTiming(360, { duration: 15000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const spin1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinAnim.value}deg` }] }));
  const spin2 = useAnimatedStyle(() => ({ transform: [{ rotate: `-${spinAnim.value * 1.5}deg` }] }));

  return (
    <View style={styles.cinematicWrapper}>
      <View style={styles.cinematicGlow} />
      
      {/* Outer Prism */}
      <Animated.View style={[styles.prismOuter, spin1]} />
      <Animated.View style={[styles.prismInner, spin2]} />

      {/* Glass Core */}
      <View style={styles.prismCoreWrapper}>
        <BlurView intensity={100} tint="dark" style={styles.prismCore}>
          <LinearGradient colors={['rgba(20, 0, 5, 0.8)', 'rgba(0, 0, 0, 0.95)']} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="hardware-chip-outline" size={42} color="#FF0033" />
        </BlurView>
      </View>
    </View>
  );
};

export default function SeedsScreen() {
  const [items, setItems] = useState<VaultItemMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await queryVaultItems({ type: 'seed_phrase' });
      setItems(data);
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const filtered = search.trim()
    ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : items;

  const handlePress = (item: VaultItemMetadata) => {
    (globalThis as any).__zerovault_lastParams = { editId: item.id };
    router.push({ pathname: '/item/[id]', params: { id: item.id } });
  };

  return (
    <View style={styles.container}>

      <SeedBackground />

      <View style={styles.header}>
        <Text style={styles.hudTag}>[ CRYPTO KEYSPACE BANK ]</Text>
        <Text style={styles.title}>Seed Phrases</Text>

        <View style={styles.searchBox}>
          <Ionicons name="terminal-outline" size={16} color="#FF0033" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search secure seeds_ >"
            placeholderTextColor="rgba(255, 0, 50, 0.4)"
            value={search}
            onChangeText={setSearch}
            keyboardAppearance="dark"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <CinematicSeedsEmpty />
          <Text style={styles.emptyTitle}>NO SEED PHRASES</Text>
          <Text style={styles.emptySubtitle}>
            Store your cryptocurrency wallet seed phrases here.{'\n'}Everything is encrypted locally using Argon2 keys.
          </Text>
          <View style={{ marginTop: 32 }}>
            <LiquidGlassButton
              title="GENERATE SEED NODE"
              icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
              onPress={() => router.push('/create-seed')}
              width={240}
              height={60}
            />
          </View>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VaultCard item={item} onPress={() => handlePress(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            search ? (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySubtitle}>No seeds matching &quot;{search}&quot;</Text>
              </View>
            ) : null
          }
        />
      )}

      {items.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => router.push('/create-seed')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent' 
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
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 60, 
    paddingBottom: 16,
  },
  hudTag: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: '800',
  },
  title: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#FFFFFF', 
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 50, 0.2)',
  },
  searchInput: { 
    flex: 1, 
    color: '#FF0033', 
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
  },
  list: { 
    paddingHorizontal: 20, 
    paddingTop: 12, 
    paddingBottom: 120,
  },
  emptyState: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingBottom: 120,
    paddingHorizontal: 32,
  },
  cinematicWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  cinematicGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF0033',
    opacity: 0.3,
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 20,
  },
  prismOuter: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.4)',
    borderStyle: 'dashed',
  },
  prismInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 51, 0.2)',
  },
  prismCoreWrapper: {
    width: 86,
    height: 86,
    borderRadius: 20,
    transform: [{ rotate: '45deg' }],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.6)',
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  prismCore: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  emptyTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFFFFF', 
    marginTop: 8,
    letterSpacing: 1,
  },
  emptySubtitle: { 
    fontSize: 13, 
    color: '#8E8E93', 
    textAlign: 'center', 
    marginTop: 8, 
    lineHeight: 20,
  },
  emptySearch: { 
    alignItems: 'center', 
    paddingVertical: 40,
  },
  addButton: {
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 28,
    width: 190,
  },
  btnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: { 
    color: '#000000', 
    fontWeight: '800', 
    fontSize: 13,
    letterSpacing: 0.5,
  },
  fab: {
    position: 'absolute',
    bottom: 104,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 99,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
