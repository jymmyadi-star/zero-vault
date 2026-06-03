import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, router as expoRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVaultItem } from '../../hooks/useVaultItem';
import { useTOTP } from '../../hooks/useTOTP';
import { deleteVaultItem, toggleFavorite } from '../../lib/services/vault-service';
import type { PasswordPayload, SeedPayload, NotePayload } from '../../lib/validation/vault-schemas';
import { hapticTouch, hapticSuccess, hapticWarning } from '../../lib/haptics';
import { copyToClipboard } from '../../lib/clipboard';
import { DetailRow, PasswordView, SeedView, NoteView, MetadataSection, EmptyState, LoadingState } from '../../components/VaultItemViews';

const { width, height } = Dimensions.get('window');

function confirmDelete(id: string, back: () => void) {
  hapticWarning();
  Alert.alert('Purge Entry', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Purge Data', style: 'destructive', onPress: async () => { await deleteVaultItem(id); back(); } },
  ]);
}

export default function VaultItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { item, error, reload } = useVaultItem(id);
  const [showPassword, setShowPassword] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);

  const pwd = item?.itemType === 'password' ? (item.payload as PasswordPayload) : null;
  const totp = useTOTP(pwd?.totpSecret);

  const toggleFav = async () => {
    if (!id) return;
    await toggleFavorite(id);
    reload();
  };

  const getTypeLabel = () => {
    if (item?.itemType === 'password') return 'CRYPTOGRAPHIC SERVICE NODE';
    if (item?.itemType === 'seed_phrase') return 'SECURE RECOVERY MNEMONIC';
    return 'SECURE DECRYPTED NOTE';
  };

  const back = () => expoRouter.back();

  if (error) return <EmptyState error={error} onRetry={reload} onBack={back} insets={insets} />;
  if (!item) return <LoadingState />;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.gridOverlay}>
        <LinearGradient colors={['rgba(255,255,255,0.02)', 'transparent']} style={StyleSheet.absoluteFillObject} />
      </View>
      <View style={[styles.ambientGlow, { backgroundColor: 'rgba(255,255,255,0.005)' }]} />

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={back} style={styles.closeButton}>
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleFav} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name={item.favorite ? 'star' : 'star-outline'} size={18} color={item.favorite ? '#FFD60A' : '#8E8E93'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            (globalThis as any).__zerovault_lastParams = { editId: id };
            expoRouter.push({
              pathname: item.itemType === 'password' ? '/create-password' : item.itemType === 'seed_phrase' ? '/create-seed' : '/create-note',
              params: { editId: id },
            });
          }} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="create-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(id, back)} hitSlop={8} style={styles.dangerBtn}>
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.typeTag}>[ {getTypeLabel()} ]</Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.urlHint ? (
          <TouchableOpacity onPress={() => copyToClipboard(item.urlHint!)} style={styles.urlRow}>
            <Ionicons name="link-outline" size={12} color="#8E8E93" />
            <Text style={styles.urlText}>{item.urlHint}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 20 }} />

        {item.itemType === 'password' && pwd && (
          <PasswordView payload={pwd} showPassword={showPassword} onTogglePassword={() => { hapticTouch(); setShowPassword(!showPassword); }} totp={totp} />
        )}
        {item.itemType === 'seed_phrase' && (
          <SeedView payload={item.payload as SeedPayload} showMnemonic={showMnemonic} onToggleMnemonic={(show) => { if (show) { hapticWarning(); Alert.alert('Reveal Mnemonic', 'Ensure physical security.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reveal', onPress: () => { hapticSuccess(); setShowMnemonic(true); } }]); } else { hapticTouch(); setShowMnemonic(false); } }} />
        )}
        {item.itemType === 'note' && <NoteView payload={item.payload as NotePayload} />}

        <MetadataSection item={item} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020204' },
  gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.5 },
  ambientGlow: { position: 'absolute', top: -height * 0.2, right: -width * 0.3, width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  closeButton: { padding: 8 },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  dangerBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.05)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.15)', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 12 },
  typeTag: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b', letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  urlText: { fontSize: 12, color: '#8E8E93' },
});
