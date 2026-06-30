import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { consentManager } from '../lib/consent-manager';
import { GDPR } from '../constants/gdpr';
import { kv } from '../lib/storage';
import { hapticTouch, hapticSuccess } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function CookieConsentScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState(false);
  const [crash, setCrash] = useState(false);

  const handleAccept = () => {
    if (analytics) consentManager.grant('analytics', GDPR.PRIVACY_POLICY.current_version);
    if (crash) consentManager.grant('crash_reporting', GDPR.PRIVACY_POLICY.current_version);
    kv.set('zerovault_cookie_consent', 'true');
    hapticSuccess();
    router.back();
  };

  const handleReject = () => {
    consentManager.withdraw('analytics');
    consentManager.withdraw('crash_reporting');
    kv.set('zerovault_cookie_consent', 'true');
    hapticSuccess();
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.hudTag}>[ TRACKING PROTOCOL ]</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>COOKIE & TRACKING</Text>
        <Text style={styles.subtitle}>ePrivacy Directive + GDPR Compliance</Text>

        <View style={styles.ePrivacyStrip}>
          <Ionicons name="hand-left-outline" size={14} color="#00F0FF" />
          <Text style={styles.ePrivacyText}>
            This app uses tracking technologies in compliance with the EU ePrivacy Directive and GDPR.
          </Text>
        </View>

        {/* Essential */}
        <View style={styles.pod}>
          <View style={styles.podHeader}>
            <View style={styles.requiredBadge}><Text style={styles.requiredBadgeText}>REQUIRED</Text></View>
            <Text style={styles.podTitle}>ESSENTIAL (ALWAYS ACTIVE)</Text>
          </View>
          <Text style={styles.podBody}>These are necessary for the enclave to function:</Text>
          <Text style={styles.bullet}>Â· Session authentication token (server login)</Text>
          <Text style={styles.bullet}>Â· Local encrypted storage keys (device only)</Text>
          <Text style={styles.bullet}>Â· Security and integrity verification</Text>
        </View>

        {/* Analytics */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>ANALYTICS (OPTIONAL)</Text>
          <Text style={styles.podBody}>Anonymous usage statistics. No vault data is ever tracked.</Text>
          <Switch
            value={analytics}
            onValueChange={setAnalytics}
            trackColor={{ false: 'rgba(255,255,255,0.05)', true: 'rgba(0,240,255,0.15)' }}
            thumbColor={analytics ? '#00F0FF' : '#52525b'}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        </View>

        {/* Crash Reporting */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>CRASH REPORTING (OPTIONAL)</Text>
          <Text style={styles.podBody}>Error reports to improve stability. No personal data sent.</Text>
          <Switch
            value={crash}
            onValueChange={setCrash}
            trackColor={{ false: 'rgba(255,255,255,0.05)', true: 'rgba(0,240,255,0.15)' }}
            thumbColor={crash ? '#00F0FF' : '#52525b'}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        </View>

        {/* Third-Party Processors */}
        <View style={styles.pod}>
          <Text style={styles.podTitle}>THIRD-PARTY PROCESSORS</Text>
          {GDPR.THIRD_PARTY_PROCESSORS.map((p) => (
            <View key={p.name} style={styles.processorItem}>
              <Text style={styles.processorName}>{p.name}</Text>
              <Text style={styles.processorDesc}>{p.purpose}</Text>
              <Text style={styles.processorLoc}>{p.location}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
          <LinearGradient colors={['#00F0FF', '#0072FF']} style={styles.btnGradient}>
            <Text style={styles.btnText}>ACCEPT CONFIGURATION</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.7}>
          <Text style={styles.rejectText}>REJECT NON-ESSENTIAL</Text>
        </TouchableOpacity>
      </View>
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
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  subtitle: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555', marginBottom: 20,
  },
  ePrivacyStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,240,255,0.04)', borderRadius: 10, padding: 12,
    borderLeftWidth: 2, borderLeftColor: '#00F0FF', marginBottom: 20,
  },
  ePrivacyText: { fontSize: 11, color: '#D4D4D8', flex: 1, lineHeight: 16 },
  pod: {
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  podHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  requiredBadge: {
    backgroundColor: 'rgba(0,240,255,0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  requiredBadgeText: {
    fontSize: 7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1,
  },
  podTitle: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00F0FF', fontWeight: '800', letterSpacing: 1, marginBottom: 8,
  },
  podBody: { fontSize: 12, color: '#8E8E93', lineHeight: 18, marginBottom: 4 },
  bullet: { fontSize: 11, color: '#D4D4D8', lineHeight: 18, paddingLeft: 8, marginBottom: 2 },
  processorItem: {
    paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  processorName: { fontSize: 12, color: '#FFFFFF', fontWeight: '600', marginBottom: 2 },
  processorDesc: { fontSize: 10, color: '#8E8E93', lineHeight: 14 },
  processorLoc: { fontSize: 9, color: '#555555', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  footer: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  acceptBtn: { borderRadius: 16, overflow: 'hidden' },
  btnGradient: { paddingVertical: 16, alignItems: 'center' },
  btnText: {
    fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800', color: '#020204', letterSpacing: 1,
  },
  rejectBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rejectText: {
    fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800', color: '#8E8E93', letterSpacing: 1,
  },
});
