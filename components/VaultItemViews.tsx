/**
 * VaultItemViews — decomposed UI components for vault item detail screen
 * Extracted from app/item/[id].tsx (was 757 lines monolithic rendering)
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PasswordPayload, SeedPayload, NotePayload } from '../lib/validation/vault-schemas';
import type { DecryptedVaultItem } from '../lib/services/vault-service';
import { copyToClipboard } from '../lib/clipboard';
import { hapticTouch } from '../lib/haptics';

const { width } = Dimensions.get('window');

// ─── DETAIL ROW ───

export function DetailRow({ label, value, isSecret, onCopy }: { label: string; value: string; isSecret?: boolean; onCopy?: () => void }) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue} numberOfLines={3}>{isSecret ? '••••••' : value}</Text>
      </View>
      {onCopy && (
        <TouchableOpacity onPress={() => { hapticTouch(); onCopy(); }} hitSlop={8} style={s.actionBtn}>
          <Ionicons name="copy-outline" size={15} color="#8E8E93" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── PASSWORD VIEW ───

export function PasswordView({ payload, showPassword, onTogglePassword, totp }: { payload: PasswordPayload; showPassword: boolean; onTogglePassword: () => void; totp: { code: string; remaining: number; error: boolean } }) {
  return (
    <View style={s.detailsGroup}>
      <View style={s.pod}>
        {payload.username ? <><DetailRow label="Identifier / Username" value={payload.username} onCopy={() => copyToClipboard(payload.username!)} /><View style={s.divider} /></> : null}
        <View style={s.row}>
          <View style={s.rowLeft}>
            <Text style={s.rowLabel}>SECURE KEY</Text>
            <Text style={s.rowValue} numberOfLines={1}>{showPassword ? payload.password : '\u2022'.repeat(Math.min(16, payload.password.length))}</Text>
          </View>
          <View style={s.rowActions}>
            <TouchableOpacity onPress={onTogglePassword} hitSlop={8} style={s.actionBtn}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color="#8E8E93" /></TouchableOpacity>
            <TouchableOpacity onPress={() => copyToClipboard(payload.password)} hitSlop={8} style={s.actionBtn}><Ionicons name="copy-outline" size={15} color="#8E8E93" /></TouchableOpacity>
          </View>
        </View>
        {payload.url ? <><View style={s.divider} /><DetailRow label="Service Destination (URL)" value={payload.url} onCopy={() => copyToClipboard(payload.url!)} /></> : null}
        {payload.totpSecret ? <>
          <View style={s.divider} />
          <View style={s.row}><View style={s.rowLeft}><Text style={s.rowLabel}>TWO-FACTOR CODE</Text><Text style={[s.rowValue, { fontSize: 24, fontWeight: '800', letterSpacing: 4 }]}>{totp.code || '------'}</Text></View><View style={s.rowActions}><View style={s.totpTimer}><View style={[s.totpTimerFill, { width: `${(totp.remaining / 30) * 100}%` }]} /></View><TouchableOpacity onPress={() => copyToClipboard(totp.code)} hitSlop={8} style={s.actionBtn}><Ionicons name="copy-outline" size={15} color="#8E8E93" /></TouchableOpacity></View></View>
          <View style={[s.divider, { marginTop: 0 }]} />
          <DetailRow label="TOTP Secret (Base32)" value={payload.totpSecret} isSecret onCopy={() => copyToClipboard(payload.totpSecret!)} />
        </> : null}
      </View>
      {payload.notes ? <View style={s.notesSection}><Text style={s.sectionLabel}>[ SECURE DATA MEMO ]</Text><View style={s.notesContainer}><Text style={s.notesText} selectable>{payload.notes}</Text></View></View> : null}
    </View>
  );
}

// ─── SEED VIEW ───

export function SeedView({ payload, showMnemonic, onToggleMnemonic }: { payload: SeedPayload; showMnemonic: boolean; onToggleMnemonic: (show: boolean) => void }) {
  return (
    <View style={s.detailsGroup}>
      <View style={s.pod}>
        {payload.walletName ? <><DetailRow label="Wallet Host Identifier" value={payload.walletName} onCopy={() => copyToClipboard(payload.walletName!)} /><View style={s.divider} /></> : null}
        {payload.passphrase ? <><DetailRow label="Extra Passphrase (25th Word)" value={payload.passphrase} isSecret onCopy={() => copyToClipboard(payload.passphrase!)} /><View style={s.divider} /></> : null}
        {payload.derivationPath ? <DetailRow label="Derivation Schema" value={payload.derivationPath} onCopy={() => copyToClipboard(payload.derivationPath!)} /> : null}
      </View>
      <View style={s.notesSection}>
        <Text style={s.sectionLabel}>[ SECURE MNEMONIC KEYSPACE ]</Text>
        {!showMnemonic ? (
          <TouchableOpacity style={s.revealBtn} onPress={() => onToggleMnemonic(true)}>
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" /><Text style={s.revealText}>TAP TO UNSEAL KEYSPACE</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={s.mnemonicGrid}>{payload.mnemonic.split(/\s+/).map((word, i) => <View key={i} style={s.mnemonicWord}><Text style={s.mnemonicIndex}>{String(i + 1).padStart(2, '0')}</Text><Text style={s.mnemonicText}>{word}</Text></View>)}</View>
            <View style={s.seedActions}>
              <TouchableOpacity style={s.copyBtn} onPress={() => copyToClipboard(payload.mnemonic)}><Ionicons name="copy-outline" size={13} color="#FFFFFF" /><Text style={s.copyBtnText}>COPY ALL WORDS</Text></TouchableOpacity>
              <TouchableOpacity style={[s.copyBtn, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.05)' }]} onPress={() => onToggleMnemonic(false)}><Ionicons name="eye-off-outline" size={13} color="#8E8E93" /><Text style={[s.copyBtnText, { color: '#8E8E93' }]}>SEAL WORDS</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {payload.notes ? <View style={s.notesSection}><Text style={s.sectionLabel}>[ SECURE DATA MEMO ]</Text><View style={s.notesContainer}><Text style={s.notesText} selectable>{payload.notes}</Text></View></View> : null}
    </View>
  );
}

// ─── NOTE VIEW ───

export function NoteView({ payload }: { payload: NotePayload }) {
  return (
    <View style={s.noteReaderContainer}>
      <Text style={s.noteContentText} selectable>{payload.content}</Text>
    </View>
  );
}

// ─── METADATA SECTION ───

export function MetadataSection({ item }: { item: DecryptedVaultItem }) {
  return (
    <View style={[s.pod, { marginTop: 20, opacity: 0.6 }]}>
      <Text style={s.sectionLabel}>[ SYSTEM METADATA ]</Text>
      <View style={s.metaRow}><Text style={s.metaLabel}>Node ID</Text><Text style={s.metaValue}>{item.id}</Text></View>
      <View style={s.metaRow}><Text style={s.metaLabel}>Created</Text><Text style={s.metaValue}>{new Date(item.createdAt).toLocaleDateString()}</Text></View>
      <View style={s.metaRow}><Text style={s.metaLabel}>Updated</Text><Text style={s.metaValue}>{new Date(item.updatedAt).toLocaleDateString()}</Text></View>
      {item.folder ? <View style={s.metaRow}><Text style={s.metaLabel}>Folder</Text><Text style={s.metaValue}>{item.folder}</Text></View> : null}
    </View>
  );
}

// ─── EMPTY / LOADING / ERROR ───

export function EmptyState({ error, onRetry, onBack, insets }: { error: string; onRetry: () => void; onBack: () => void; insets: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#020204' }}>
      <View style={[s.headerRow, { paddingTop: (insets?.top || 0) + 16 }]}>
        <TouchableOpacity onPress={onBack} style={s.closeButton}><Ionicons name="chevron-back" size={20} color="#8E8E93" /></TouchableOpacity>
      </View>
      <View style={s.errorState}>
        <Ionicons name="warning-outline" size={48} color="#FF3B30" />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity onPress={onRetry} style={s.retryBtn}><Text style={s.retryText}>RETRY</Text></TouchableOpacity>
      </View>
    </View>
  );
}

export function LoadingState() {
  return (
    <View style={{ flex: 1, backgroundColor: '#020204', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#8E8E93', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 1.5 }}>DECRYPTING NODE...</Text>
    </View>
  );
}

// ─── STYLES ───

const s = StyleSheet.create({
  detailsGroup: { gap: 12 },
  pod: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  rowLeft: { flex: 1, marginRight: 8 },
  rowLabel: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b', letterSpacing: 1.5, marginBottom: 4, textTransform: 'uppercase' },
  rowValue: { fontSize: 14, color: '#D4D4D8', fontWeight: '500' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtn: { padding: 6 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 10 },
  totpTimer: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  totpTimerFill: { height: '100%', borderRadius: 2, backgroundColor: '#00F0FF' },
  notesSection: { marginTop: 4 },
  sectionLabel: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  notesContainer: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', padding: 14 },
  notesText: { fontSize: 13, color: '#8E8E93', lineHeight: 20 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,59,48,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,59,48,0.15)', paddingVertical: 16, paddingHorizontal: 16, justifyContent: 'center' },
  revealText: { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#FF3B30', letterSpacing: 1.5 },
  mnemonicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  mnemonicWord: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', paddingVertical: 6, paddingHorizontal: 10 },
  mnemonicIndex: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b', width: 16 },
  mnemonicText: { fontSize: 12, color: '#D4D4D8', fontWeight: '500' },
  seedActions: { flexDirection: 'row', gap: 10 },
  copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 10 },
  copyBtnText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  noteReaderContainer: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', padding: 16, minHeight: 200 },
  noteContentText: { fontSize: 14, color: '#D4D4D8', lineHeight: 24 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  metaLabel: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#52525b' },
  metaValue: { fontSize: 11, color: '#8E8E93', maxWidth: '60%', textAlign: 'right' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  closeButton: { padding: 8 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { fontSize: 13, color: '#FF3B30', textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingHorizontal: 32 },
  retryBtn: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingVertical: 10, paddingHorizontal: 24 },
  retryText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.5 },
});
