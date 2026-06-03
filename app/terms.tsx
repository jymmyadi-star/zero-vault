import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { consentManager } from '../lib/consent-manager';
import { GDPR } from '../constants/gdpr';
import { kv } from '../lib/storage';
import { hapticTouch, hapticSuccess, hapticWarning } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function TermsScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isViewMode = mode === 'view';

  const [tick1, setTick1] = useState(false);
  const [tick2, setTick2] = useState(false);
  const [tick3, setTick3] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const all = tick1 && tick2 && tick3;

  const handleAccept = () => {
    if (!all) return;
    hapticSuccess();
    consentManager.grant('terms_of_use', '1.0.0');
    consentManager.grant('privacy_policy', GDPR.PRIVACY_POLICY.current_version);
    kv.set('zerovault_terms_accepted', 'true');
    router.replace('/unlock');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#08080C', '#020204']} style={StyleSheet.absoluteFillObject} />
      <View style={styles.ambientGlow} />

      <View style={styles.header}>
        <Text style={styles.hudTag}>[ LEGAL PROTOCOL ]</Text>
        <Text style={styles.title}>TERMS OF USE</Text>
        <Text style={styles.version}>v1.0.0 // {GDPR.PRIVACY_POLICY.effective_date}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ZERO-KNOWLEDGE */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 01 ] ZERO-KNOWLEDGE ARCHITECTURE</Text>
          <Text style={styles.podBody}>
            Zero Vault operates on a zero-knowledge protocol. Your Master PIN, decryption keys, and plaintext data NEVER leave your device. The server stores only encrypted memory blocks (XChaCha20-Poly1305 ciphertext) that cannot be decrypted without your PIN. We have no technical capability to access, recover, or reset your vault.
          </Text>
          <View style={styles.warningStrip}>
            <Ionicons name="warning" size={14} color="#FF3B30" />
            <Text style={styles.warningText}>IF YOU LOSE YOUR MASTER PIN, YOUR DATA IS PERMANENTLY AND IRREVERSIBLY LOST. ZERO VAULT CANNOT RECOVER IT.</Text>
          </View>
        </View>

        {/* EMERGENCY */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 02 ] EMERGENCY DISCLAIMER</Text>
          <Text style={styles.podBody}>
            Zero Vault is a personal password manager and encrypted vault. It does not provide professional advice, diagnosis, or emergency services. In case of emergency, contact local emergency services immediately.
          </Text>
        </View>

        {/* ELIGIBILITY */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 03 ] ELIGIBILITY</Text>
          <Text style={styles.podBody}>
            You must be at least 16 years old to use Zero Vault independently, in compliance with GDPR Article 8. Users under 16 require parental consent. Zero Vault does not knowingly collect data from children under 13.
          </Text>
        </View>

        {/* LICENSE */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 04 ] LICENSE & RESTRICTIONS</Text>
          <Text style={styles.podBody}>
            Zero Vault grants you a limited, non-exclusive license for personal use. You agree NOT to: copy, modify, reverse engineer, distribute, or use the application for illegal purposes.
          </Text>
        </View>

        {/* PRIVACY & GDPR */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 05 ] PRIVACY & GDPR</Text>
          <Text style={styles.podBody}>
            Your use is governed by the Privacy Policy. Zero Vault fully complies with GDPR. Data is encrypted before leaving your device. You have the right to access, rectify, erase, port, object, and withdraw consent at any time. Contact: privacy@zerovault.app.
          </Text>
        </View>

        {/* SUBSCRIPTIONS */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 06 ] SUBSCRIPTIONS & PAYMENTS</Text>
          <Text style={styles.podBody}>
            Premium features may be available through subscription. Subscriptions auto-renew unless cancelled 24 hours before renewal. Refunds are managed exclusively by Apple or Google.
          </Text>
        </View>

        {/* LEGAL PROTECTIONS */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>[ 07 ] LEGAL PROTECTIONS</Text>
          <Text style={styles.podBody}>
            Zero Vault is provided AS-IS without warranties of any kind. We are not liable for indirect or incidental damages. You agree to indemnify Zero Vault for damages resulting from improper use. Disputes are resolved through individual arbitration in Romania. These Terms are governed by Romanian law.
          </Text>
        </View>

        <View style={styles.divider} />

        {/* CHECKBOXES */}
        <TouchableOpacity style={styles.checkRow} onPress={() => { hapticTouch(); setTick1(!tick1); }} activeOpacity={0.7}>
          <View style={[styles.checkbox, tick1 && styles.checkboxOn]}>
            {tick1 && <Ionicons name="checkmark" size={12} color="#020204" />}
          </View>
          <Text style={styles.checkLabel}>I have read and agree to the Terms of Use.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => { hapticTouch(); setTick2(!tick2); }} activeOpacity={0.7}>
          <View style={[styles.checkbox, tick2 && styles.checkboxOn]}>
            {tick2 && <Ionicons name="checkmark" size={12} color="#020204" />}
          </View>
          <Text style={styles.checkLabel}>I understand Zero Vault is AS-IS with ZERO liability for data loss.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => { hapticTouch(); setTick3(!tick3); }} activeOpacity={0.7}>
          <View style={[styles.checkbox, tick3 && styles.checkboxOn]}>
            {tick3 && <Ionicons name="checkmark" size={12} color="#020204" />}
          </View>
          <Text style={styles.checkLabel}>I accept the Privacy Policy and understand my GDPR rights.</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        {!isViewMode && (
          <TouchableOpacity
            style={[styles.acceptBtn, !all && styles.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={!all}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={all ? ['#00F0FF', '#0072FF'] : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.03)']}
              style={styles.acceptGradient}
            >
              <Text style={[styles.acceptText, !all && { color: '#52525b' }]}>INITIALIZE ENCLAVE_</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {isViewMode && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.closeText}>CLOSE</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.push('/privacy-policy' as never)} style={styles.linkBtn} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={14} color="#00F0FF" />
          <Text style={styles.linkText}>VIEW PRIVACY POLICY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020204' },
  ambientGlow: {
    position: 'absolute', top: -height * 0.2, right: -width * 0.3,
    width: width * 0.8, height: width * 0.8, borderRadius: (width * 0.8) / 2,
    backgroundColor: 'rgba(0, 240, 255, 0.008)',
  },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  hudTag: {
    fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#8E8E93', letterSpacing: 2, marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  version: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555', marginTop: 6,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },
  pod: {
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  podTitle: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1, marginBottom: 10,
  },
  podBody: { fontSize: 13, color: '#8E8E93', lineHeight: 20 },
  warningStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 10, padding: 10, backgroundColor: 'rgba(255, 59, 48, 0.06)',
    borderRadius: 8, borderLeftWidth: 2, borderLeftColor: '#FF3B30',
  },
  warningText: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF3B30', fontWeight: '800', flex: 1, lineHeight: 15,
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.03)', marginVertical: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#00F0FF', borderColor: '#00F0FF' },
  checkLabel: { fontSize: 13, color: '#D4D4D8', flex: 1, lineHeight: 18 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  acceptBtn: { borderRadius: 16, overflow: 'hidden' },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  acceptText: {
    fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800', color: '#020204', letterSpacing: 1,
  },
  closeBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)',
  },
  closeText: {
    fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800', color: '#8E8E93', letterSpacing: 1,
  },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  linkText: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1,
  },
});
