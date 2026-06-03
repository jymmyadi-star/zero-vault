import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VaultCard } from '../../components/VaultCard';
import { queryVaultItems, type VaultItemMetadata } from '../../lib/services/vault-service';

const { width, height } = Dimensions.get('window');

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
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />

      {/* Cyber Grid & Ambient Glows */}
      <View style={styles.gridOverlay}>
        <LinearGradient colors={['rgba(255, 255, 255, 0.005)', 'transparent']} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={styles.ambientGlow} />

      <View style={styles.header}>
        <Text style={styles.hudTag}>[ CRYPTO KEYSPACE BANK ]</Text>
        <Text style={styles.title}>Seed Phrases</Text>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="#8E8E93" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search secure seeds..."
            placeholderTextColor="rgba(255, 255, 255, 0.25)"
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
          <View style={styles.emptyIconContainer}>
            <Ionicons name="leaf" size={32} color="#A1A1AA" />
          </View>
          <Text style={styles.emptyTitle}>No seed phrases saved</Text>
          <Text style={styles.emptySubtitle}>
            Store your cryptocurrency wallet seed phrases here.{'\n'}Everything is encrypted locally using Argon2 keys.
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 }]}
            onPress={() => router.push('/create-seed')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={[styles.addButtonText, { color: '#FFFFFF' }]}>Generate Seed Node</Text>
          </TouchableOpacity>
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
                <Text style={styles.emptySubtitle}>No seeds matching "{search}"</Text>
              </View>
            ) : null
          }
        />
      )}

      {items.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { borderWidth: 1, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.02)', shadowColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => router.push('/create-seed')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#020204' 
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
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 60, 
    paddingBottom: 16,
  },
  hudTag: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93',
    letterSpacing: 2,
    marginBottom: 6,
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
    backgroundColor: '#0D0D12',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  searchInput: { 
    flex: 1, 
    color: '#FFFFFF', 
    fontSize: 14,
    fontWeight: '500',
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
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#FFFFFF', 
    marginTop: 8,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    zIndex: 99,
  },
  fabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
