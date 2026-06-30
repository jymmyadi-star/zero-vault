import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseImport, executeImport, type ImportPreviewItem } from '../lib/services/import-service';
import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function ImportVaultScreen() {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState<ImportPreviewItem[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  const handlePaste = async () => {
    hapticTouch();
    try {
      const Clipboard = require('expo-clipboard');
      const text = await Clipboard.getStringAsync();
      if (!text || text.length < 10) {
        hapticWarning();
        Alert.alert('Empty Clipboard', 'Copy your exported passwords to clipboard first (CSV or Bitwarden JSON).');
        return;
      }

      const summary = parseImport(text);
      setPreview(summary.items);
      setResult(null);

      if (summary.items.length === 0) {
        hapticWarning();
        Alert.alert('No Data Found', 'Could not detect a supported format. Supported: CSV, Bitwarden JSON, 1Password CSV, Chrome CSV.');
      } else {
        hapticSuccess();
      }
    } catch (err: any) {
      hapticWarning();
      Alert.alert('Import Error', err.message || 'Failed to read clipboard.');
    }
  };

  const handleExecuteImport = async () => {
    if (!preview || preview.length === 0) return;
    hapticTouch();

    const valid = preview.filter((i) => i.errors.length === 0);
    if (valid.length === 0) {
      Alert.alert('No Valid Items', 'All detected items have errors. Check your data format.');
      return;
    }

    Alert.alert(
      `Import ${valid.length} items?`,
      `${valid.length} items will be imported. ${preview.length - valid.length} will be skipped due to errors.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setImporting(true);
            try {
              const res = await executeImport(valid);
              setResult(res);
              hapticSuccess();
            } catch (err: any) {
              hapticWarning();
              Alert.alert('Import Failed', err.message);
            } finally {
              setImporting(false);
            }
          },
        },
      ],
    );
  };

  const validCount = preview?.filter((i) => i.errors.length === 0).length ?? 0;

  return (
    <View style={styles.container}>

      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#8E8E93" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.hudTag}>[ DATA MIGRATION ]</Text>
          <Text style={styles.headerTitle}>Import Vault</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
        {!preview && (
          <View style={styles.emptyState}>
            <Ionicons name="download-outline" size={56} color="#8E8E93" style={{ marginBottom: 20 }} />
            <Text style={styles.emptyTitle}>Import from another manager</Text>
            <Text style={styles.emptySub}>
              Copy your exported passwords from Bitwarden, 1Password, Chrome, or any CSV file to your clipboard, then tap below.
            </Text>

            <TouchableOpacity style={styles.pasteBtn} onPress={handlePaste} activeOpacity={0.8}>
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={StyleSheet.absoluteFillObject} />
              <Ionicons name="clipboard-outline" size={18} color="#FFFFFF" />
              <Text style={styles.pasteText}>SCAN CLIPBOARD</Text>
            </TouchableOpacity>

            <View style={styles.formatList}>
              <Text style={styles.formatTitle}>[ SUPPORTED FORMATS ]</Text>
              {['Bitwarden JSON export', '1Password CSV export', 'Chrome Password CSV', 'Generic CSV (title,url,username,password)'].map((f, i) => (
                <View key={i} style={styles.formatRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.formatText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {preview && !result && (
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Preview Import</Text>
              <Text style={styles.previewCount}>{preview.length} items ({validCount} valid)</Text>
            </View>

            {preview.slice(0, 20).map((item, i) => (
              <View key={i} style={styles.previewItem}>
                <View style={styles.previewLeft}>
                  <Ionicons
                    name={item.errors.length > 0 ? 'alert-circle' : 'checkmark-circle'}
                    size={18}
                    color={item.errors.length > 0 ? '#FF3B30' : '#34C759'}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewItemTitle} numberOfLines={1}>{item.title || '(no title)'}</Text>
                    <Text style={styles.previewItemMeta} numberOfLines={1}>
                      {item.itemType} {item.username ? `Â· ${item.username}` : ''} {item.url ? `Â· ${item.url}` : ''}
                    </Text>
                  </View>
                </View>
                {item.errors.length > 0 && (
                  <Text style={styles.previewError}>{item.errors.join(', ')}</Text>
                )}
              </View>
            ))}

            {preview.length > 20 && (
              <Text style={styles.moreText}>... and {preview.length - 20} more</Text>
            )}

            <TouchableOpacity
              style={[styles.importBtn, { opacity: importing ? 0.6 : 1 }]}
              onPress={handleExecuteImport}
              disabled={importing}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['#00F0FF', '#0072FF']} style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]} />
              <Text style={styles.importBtnText}>
                {importing ? 'IMPORTING...' : `IMPORT ${validCount} ITEMS`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPreview(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#8E8E93', fontSize: 12, fontFamily: 'Courier', letterSpacing: 1 }}>RESCAN CLIPBOARD</Text>
            </TouchableOpacity>
          </View>
        )}

        {result && (
          <View style={styles.resultSection}>
            <Ionicons
              name={result.failed === 0 ? 'checkmark-circle' : 'alert-circle'}
              size={56}
              color={result.failed === 0 ? '#34C759' : '#FF9F0A'}
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.resultTitle}>Import Complete</Text>
            <Text style={styles.resultText}>
              {result.imported} items imported successfully.{result.failed > 0 ? ` ${result.failed} items failed.` : ''}
            </Text>
            <TouchableOpacity
              style={[styles.importBtn, { marginTop: 24 }]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]} />
              <Text style={[styles.importBtnText, { color: '#FFFFFF' }]}>RETURN TO VAULT</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.02)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  headerCenter: { alignItems: 'center' },
  hudTag: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#8E8E93', letterSpacing: 2, marginBottom: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  scroll: { paddingHorizontal: 20, paddingTop: 24 },
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  emptySub: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20, marginBottom: 32 },
  pasteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    height: 56, paddingHorizontal: 32, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  pasteText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1.5 },
  formatList: { marginTop: 40, width: '100%', paddingHorizontal: 16 },
  formatTitle: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#8E8E93', fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },
  formatRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  formatText: { fontSize: 13, color: '#FFFFFF' },
  previewSection: { gap: 12 },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  previewTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  previewCount: { fontSize: 11, fontFamily: 'Courier', color: '#8E8E93' },
  previewItem: {
    backgroundColor: '#0D0D12', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
  },
  previewLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewItemTitle: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  previewItemMeta: { fontSize: 11, color: '#8E8E93', marginTop: 4, fontFamily: 'Courier' },
  previewError: { fontSize: 10, color: '#FF3B30', marginTop: 6, fontFamily: 'Courier' },
  moreText: { fontSize: 11, color: '#8E8E93', textAlign: 'center', fontFamily: 'Courier', marginTop: 8 },
  importBtn: {
    height: 56, borderRadius: 16, overflow: 'hidden', marginTop: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  importBtnText: { color: '#000000', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  resultSection: { alignItems: 'center', paddingTop: 60 },
  resultTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  resultText: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
});
