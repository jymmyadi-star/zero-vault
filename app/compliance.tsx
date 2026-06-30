import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { consentManager } from '../lib/consent-manager';
import { dataBreachManager } from '../lib/data-breach';
import { GDPR } from '../constants/gdpr';
import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function ComplianceScreen() {
  const router = useRouter();

  const handleExportData = async () => {
    hapticTouch();
    try {
      const { collection } = require('../lib/db');
      const items = await collection.get('vault_items').query().fetch();
      const consentRecords = consentManager.exportRecords();
      const exportData = {
        exported_at: new Date().toISOString(),
        app: 'Zero Vault',
        vault_items: items.map((i: any) => ({
          id: i.id,
          item_type: i.itemType,
          title: i.title,
          folder: i.folder,
          favorite: i.favorite,
          created_at: new Date(i.createdAt).toISOString(),
          note: 'PAYLOAD IS ENCRYPTED â€” decryptable only with your Master PIN',
        })),
        consent_records: consentRecords,
      };

      const { Share } = require('react-native');
      await Share.share({
        message: `Zero Vault Data Export - ${new Date().toISOString()}\n\n${JSON.stringify(exportData, null, 2)}`,
        title: 'Zero Vault Data Export',
      });
      hapticSuccess();
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    }
  };

  const handleExportAuditLog = async () => {
    hapticTouch();
    const logs = consentManager.exportRecords();
    const { Share } = require('react-native');
    await Share.share({
      message: `Zero Vault Consent Records - ${new Date().toISOString()}\n\n${JSON.stringify(logs, null, 2)}`,
      title: 'Zero Vault Audit Log',
    });
    hapticSuccess();
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.hudTag}>[ COMPLIANCE PROTOCOL ]</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>COMPLIANCE CENTER</Text>

        {/* Status Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>E2EE PROTOCOL</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>ZERO-KNOWLEDGE</Text></View>
          <View style={styles.badge}><Text style={styles.badgeText}>GDPR COMPLIANT</Text></View>
        </View>

        {/* GDPR Rights */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ GDPR RIGHTS ]</Text>
          {GDPR.DATA_SUBJECT_RIGHTS.map((r) => (
            <Text key={r.article} style={styles.rightsItem}>Â· {r.article}: {r.right}</Text>
          ))}
          <Text style={styles.podBody}>Contact: {GDPR.DATA_CONTROLLER.privacy_email}</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} activeOpacity={0.7}>
          <Ionicons name="cloud-download-outline" size={18} color="#00F0FF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Data Export (Art. 20)</Text>
            <Text style={styles.actionSub}>Portability â€” export your vault metadata</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#52525b" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleExportAuditLog} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={18} color="#00F0FF" />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Consent Records (Art. 15)</Text>
            <Text style={styles.actionSub}>Access â€” export your consent history</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#52525b" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => {
          Alert.alert('Right to Object (Art. 21)', 'You have the right to object to processing. Send an email to privacy@zerovault.app with subject "GDPR OBJECTION". Response within 30 days.', [{ text: 'OK' }]);
        }} activeOpacity={0.7}>
          <Ionicons name="hand-left-outline" size={18} color="#FF3B30" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>Right to Object (Art. 21)</Text>
            <Text style={styles.actionSub}>Object to processing of your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#52525b" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => {
          Alert.alert('Right to Restriction (Art. 18)', 'You have the right to request restriction of processing. Send an email to privacy@zerovault.app with subject "GDPR RESTRICTION". Response within 30 days.', [{ text: 'OK' }]);
        }} activeOpacity={0.7}>
          <Ionicons name="pause-circle-outline" size={18} color="#FF3B30" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>Right to Restriction (Art. 18)</Text>
            <Text style={styles.actionSub}>Restrict processing of your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#52525b" />
        </TouchableOpacity>

        {/* DPO & Authority */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ DPO & SUPERVISORY AUTHORITY ]</Text>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>DPO: {GDPR.DPO.name} | {GDPR.DPO.email}</Text>
            <Text style={styles.contactLine}>Authority: {GDPR.SUPERVISORY_AUTHORITY.short_name}</Text>
            <Text style={styles.contactLine}>Email: {GDPR.SUPERVISORY_AUTHORITY.email}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(GDPR.SUPERVISORY_AUTHORITY.website)}>
              <Text style={styles.linkLine}>{GDPR.SUPERVISORY_AUTHORITY.website}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legal Documents */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ LEGAL DOCUMENTS ]</Text>
          <TouchableOpacity style={styles.docRow} onPress={() => router.push('/privacy-policy' as never)}>
            <Ionicons name="document-text-outline" size={16} color="#00F0FF" />
            <Text style={styles.docText}>Privacy Policy (v{GDPR.PRIVACY_POLICY.current_version})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.docRow} onPress={() => router.push('/terms?mode=view' as never)}>
            <Ionicons name="document-outline" size={16} color="#00F0FF" />
            <Text style={styles.docText}>Terms of Use (v1.0.0)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.docRow} onPress={() => router.push('/cookie-consent' as never)}>
            <Ionicons name="cube-outline" size={16} color="#00F0FF" />
            <Text style={styles.docText}>Cookie & Tracking Preferences</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  ambientGlow: {
    position: 'absolute', top: -height * 0.2, right: -width * 0.3,
    width: width * 0.8, height: width * 0.8, borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(0, 240, 255, 0.008)',
  },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: 50, paddingBottom: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  backBtn: { padding: 4 },
  hudTag: {
    flex: 1, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93', letterSpacing: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  badge: {
    backgroundColor: 'rgba(0,240,255,0.06)', borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: {
    fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1,
  },
  pod: {
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  podTitle: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1, marginBottom: 10,
  },
  podBody: { fontSize: 12, color: '#8E8E93', lineHeight: 18 },
  rightsItem: { fontSize: 11, color: '#D4D4D8', lineHeight: 18, paddingLeft: 4, marginBottom: 2 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 14, marginBottom: 10,
  },
  actionTitle: { fontSize: 13, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 },
  actionSub: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555',
  },
  contactBlock: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10, gap: 4,
  },
  contactLine: { fontSize: 11, color: '#D4D4D8', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  linkLine: {
    fontSize: 10, color: '#00F0FF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  docText: { fontSize: 13, color: '#00F0FF', fontWeight: '600' },
});
