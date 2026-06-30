import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GDPR } from '../constants/gdpr';

const { width, height } = Dimensions.get('window');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.pod}>
      <Text style={styles.podTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.hudTag}>[ PRIVACY PROTOCOL ]</Text>
        <Text style={styles.version}>v{GDPR.PRIVACY_POLICY.current_version}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>PRIVACY POLICY</Text>
        <Text style={styles.date}>{GDPR.PRIVACY_POLICY.effective_date}</Text>

        <Section title="[ 01 ] DATA CONTROLLER">
          <Text style={styles.body}>{GDPR.DATA_CONTROLLER.name} is the data controller. You can contact us at any time regarding your data privacy.</Text>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>Operator: {GDPR.DATA_CONTROLLER.name}</Text>
            <Text style={styles.contactLine}>Email: {GDPR.DATA_CONTROLLER.privacy_email}</Text>
            <Text style={styles.contactLine}>Country: {GDPR.DATA_CONTROLLER.country}</Text>
          </View>
        </Section>

        <Section title="[ 02 ] DATA PROTECTION OFFICER">
          <Text style={styles.body}>We have appointed a DPO to oversee GDPR compliance.</Text>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>{GDPR.DPO.name}</Text>
            <Text style={styles.contactLine}>Email: {GDPR.DPO.email}</Text>
          </View>
        </Section>

        <Section title="[ 03 ] DATA WE PROCESS">
          <Text style={styles.body}>Local (on-device): Encrypted passwords, seed phrases, and secure notes with metadata (titles, folders, icons). All data is encrypted with XChaCha20-Poly1305 using keys derived from your Master PIN via Argon2id.</Text>
          <View style={styles.warningStrip}>
            <Ionicons name="shield-checkmark" size={14} color="#00F0FF" />
            <Text style={styles.highlightText}>ZERO-KNOWLEDGE: We have NO access to your plaintext data, Master PIN, or decryption keys. They exist only on your device.</Text>
          </View>
          <Text style={styles.body}>Server (Supabase): Encrypted opaque ciphertext blocks. The server cannot decrypt any vault item. Only metadata (anonymous user ID, timestamps) is visible server-side.</Text>
        </Section>

        <Section title="[ 04 ] LEGAL BASIS FOR PROCESSING">
          <Text style={styles.body}>Local storage: No legal basis required (local processing only).</Text>
          <Text style={styles.body}>Cloud sync: GDPR Art. 6(1)(a) â€” Consent (you manually enable sync).</Text>
          <Text style={styles.body}>Identity upgrade: GDPR Art. 6(1)(b) â€” Contractual necessity.</Text>
          <Text style={styles.body}>Consent records: GDPR Art. 6(1)(c) â€” Legal obligation.</Text>
          <Text style={styles.body}>Audit logging: GDPR Art. 6(1)(f) â€” Legitimate interests.</Text>
        </Section>

        <Section title="[ 05 ] DATA RETENTION">
          <Text style={styles.body}>Vault items remain on your device until you delete them. Cloud sync entries are deleted on account purge. Consent records are retained for 5 years after withdrawal (legal requirement). Audit logs auto-rotate (max 2000 entries).</Text>
        </Section>

        <Section title="[ 06 ] DATA SECURITY">
          <Text style={styles.body}>XChaCha20-Poly1305 per-item encryption. SQLCipher AES-256 at-rest database encryption. Argon2id PIN-to-key derivation (128MB, 6 passes, 4 lanes). Keys stored in hardware-backed Secure Enclave (iOS Keychain / Android Keystore). Zero-knowledge protocol ensures server cannot decrypt any data.</Text>
        </Section>

        <Section title="[ 07 ] INTERNATIONAL DATA TRANSFERS">
          <Text style={styles.body}>Primary servers are located in the EU (Ireland/Frankfurt). Some processors may operate in the US under EU Standard Contractual Clauses. All data is encrypted BEFORE leaving your device, remaining unreadable regardless of transfer destination.</Text>
        </Section>

        <Section title="[ 08 ] YOUR GDPR RIGHTS">
          <Text style={styles.body}>Under GDPR, you have the following rights:</Text>
          {GDPR.DATA_SUBJECT_RIGHTS.map((r) => (
            <Text key={r.article} style={styles.rightsItem}>Â· {r.article}: {r.right}</Text>
          ))}
          <Text style={styles.body}>To exercise these rights, contact: privacy@zerovault.app or dpo@zerovault.app. Response within 30 days.</Text>
        </Section>

        <Section title="[ 09 ] SUPERVISORY AUTHORITY">
          <Text style={styles.body}>If your data protection rights have been violated, you may lodge a complaint with:</Text>
          <View style={styles.contactBlock}>
            <Text style={styles.contactLine}>{GDPR.SUPERVISORY_AUTHORITY.short_name}</Text>
            <Text style={styles.contactLine}>Website: {GDPR.SUPERVISORY_AUTHORITY.website}</Text>
            <Text style={styles.contactLine}>Email: {GDPR.SUPERVISORY_AUTHORITY.email}</Text>
          </View>
        </Section>

        <Section title="[ 10 ] DATA BREACH NOTIFICATION">
          <Text style={styles.body}>In the event of a personal data breach, we will notify the supervisory authority (ANSPDCP) within 72 hours (GDPR Art. 33). If the breach poses a high risk, we will notify affected users without undue delay (GDPR Art. 34).</Text>
        </Section>

        <Section title="[ 11 ] CHILDREN'S PRIVACY">
          <Text style={styles.body}>Zero Vault is not intended for children under 13. Users aged 13-15 require parental consent per GDPR Article 8. We do not knowingly collect data from children under 13.</Text>
        </Section>

        <Section title="[ 12 ] CHANGES TO THIS POLICY">
          <Text style={styles.body}>We may update this policy periodically. Material changes will be communicated in-app with re-acceptance required.</Text>
        </Section>

        <Section title="[ 13 ] CONTACT">
          <Text style={styles.body}>Data Controller: {GDPR.DATA_CONTROLLER.name}</Text>
          <Text style={styles.body}>Email: {GDPR.DATA_CONTROLLER.privacy_email}</Text>
          <Text style={styles.body}>DPO: {GDPR.DPO.email}</Text>
          <Text style={styles.body}>Supervisory Authority: {GDPR.SUPERVISORY_AUTHORITY.short_name} â€” {GDPR.SUPERVISORY_AUTHORITY.website}</Text>
        </Section>
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
  version: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  date: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555', marginBottom: 24,
  },
  pod: {
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  podTitle: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1, marginBottom: 10,
  },
  body: { fontSize: 13, color: '#8E8E93', lineHeight: 20, marginBottom: 6 },
  contactBlock: {
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 10, marginTop: 8, gap: 4,
  },
  contactLine: { fontSize: 11, color: '#D4D4D8', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  warningStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginVertical: 10, padding: 10, backgroundColor: 'rgba(0, 240, 255, 0.04)',
    borderRadius: 8, borderLeftWidth: 2, borderLeftColor: '#00F0FF',
  },
  highlightText: { fontSize: 10, color: '#00F0FF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800', flex: 1, lineHeight: 15 },
  rightsItem: { fontSize: 11, color: '#D4D4D8', lineHeight: 18, marginBottom: 2, paddingLeft: 8 },
});
