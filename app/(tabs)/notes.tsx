import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Dimensions, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VaultCard } from '../../components/VaultCard';
import { LiquidGlassButton } from '../../components/LiquidGlassButton';
import { NoteBackground } from '../../components/NoteBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { queryVaultItems, type VaultItemMetadata } from '../../lib/services/vault-service';

const { width, height } = Dimensions.get('window');

const CinematicNotesEmpty = () => {
  const scanAnim = useSharedValue(0);
  
  React.useEffect(() => {
    scanAnim.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanAnim.value * 130 - 65 }]
  }));

  return (
    <View style={styles.cinematicWrapper}>
      <View style={styles.cinematicGlow} />
      
      <View style={styles.monolithContainer}>
        <BlurView intensity={100} tint="dark" style={styles.monolithBase}>
           <LinearGradient colors={['rgba(20, 0, 5, 0.6)', 'rgba(0, 0, 0, 0.95)']} style={StyleSheet.absoluteFillObject} />
           
           {/* Static Data Blades */}
           <View style={styles.dataBlade} />
           <View style={styles.dataBlade} />
           <View style={[styles.dataBlade, { marginTop: 45 }]} />
           <View style={styles.dataBlade} />

           {/* The Core Icon */}
           <View style={styles.monolithIconBox}>
             <Ionicons name="document-text-outline" size={38} color="#FF0033" />
           </View>

           {/* Scanner Line */}
           <Animated.View style={[styles.scannerLine, scanStyle]}>
             <LinearGradient colors={['transparent', 'rgba(255, 0, 51, 0.9)', 'transparent']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={StyleSheet.absoluteFillObject} />
           </Animated.View>
        </BlurView>
      </View>
    </View>
  );
};

export default function NotesScreen() {
  const [items, setItems] = useState<VaultItemMetadata[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await queryVaultItems({ type: 'note' });
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

      <NoteBackground />

      <View style={styles.header}>
        <Text style={styles.hudTag}>[ SECURE MEMO BANK ]</Text>
        <Text style={styles.title}>Secure Notes</Text>

        <View style={styles.searchBox}>
          <Ionicons name="terminal-outline" size={16} color="#FF0033" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search secure memos_ >"
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
          <CinematicNotesEmpty />
          <Text style={styles.emptyTitle}>NO SECURE MEMOS</Text>
          <Text style={styles.emptySubtitle}>
            Store private notes, passwords, recovery keys or memos.{'\n'}Everything is encrypted end-to-end.
          </Text>
          <View style={{ marginTop: 32 }}>
            <LiquidGlassButton
              title="CREATE MEMO"
              icon={<Ionicons name="add" size={18} color="#FFFFFF" />}
              onPress={() => router.push('/create-note')}
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
                <Text style={styles.emptySubtitle}>No results matching &quot;{search}&quot;</Text>
              </View>
            ) : null
          }
        />
      )}

      {items.length > 0 && (
        <TouchableOpacity
          style={[styles.fab, { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => router.push('/create-note')}
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
  monolithContainer: {
    width: 110,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.3)',
  },
  monolithBase: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataBlade: {
    width: '80%',
    height: 2,
    backgroundColor: 'rgba(255, 0, 51, 0.2)',
    marginVertical: 4,
  },
  monolithIconBox: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 51, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  scannerLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    shadowColor: '#FF0033',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
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
    width: 180,
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
