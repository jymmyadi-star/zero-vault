import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { consentManager } from '../lib/consent-manager';
import { GDPR } from '../constants/gdpr';
import { hapticTouch, hapticError } from '../lib/haptics';

const { width, height } = Dimensions.get('window');

export default function AgeVerificationScreen() {
  const router = useRouter();
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState('');
  const [parental, setParental] = useState(false);

  const verify = () => {
    setError('');
    const d = parseInt(day), m = parseInt(month), y = parseInt(year);
    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
      setError('INVALID DATE PARAMETERS');
      hapticError();
      return;
    }
    const dob = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (new Date(dob).toString() === 'Invalid Date' || new Date(dob) > new Date()) {
      setError('DATE OUTSIDE VALID RANGE');
      hapticError();
      return;
    }
    const age = consentManager.calculateAge(dob);
    if (age < 13) { setError('MINIMUM AGE: 13 YEARS'); hapticError(); return; }
    if (age < 16 && !parental) { setError('PARENTAL CONSENT REQUIRED FOR USERS UNDER 16'); hapticError(); return; }
    consentManager.setAgeVerified(dob);
    router.replace('/terms');
  };

  return (
    <View style={styles.container}>
      <View style={styles.ambientGlow} />

      <View style={styles.inner}>
        <Ionicons name="id-card-outline" size={40} color="#00F0FF" style={{ marginBottom: 20 }} />
        <Text style={styles.title}>AGE VERIFICATION</Text>
        <Text style={styles.subtitle}>
          Under GDPR Article 8, we must verify your age. You must be at least {GDPR.AGE_RESTRICTION.minimum_age} for independent use.
        </Text>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>DAY</Text>
            <View style={[styles.dateBox, day ? styles.dateBoxActive : null]}>
              <Text style={styles.dateVal}>{day || 'DD'}</Text>
            </View>
          </View>
          <Text style={styles.sep}>/</Text>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>MONTH</Text>
            <View style={[styles.dateBox, month ? styles.dateBoxActive : null]}>
              <Text style={styles.dateVal}>{month || 'MM'}</Text>
            </View>
          </View>
          <Text style={styles.sep}>/</Text>
          <View style={styles.dateField}>
            <Text style={styles.dateLabel}>YEAR</Text>
            <View style={[styles.dateBox, year ? styles.dateBoxActive : null]}>
              <Text style={styles.dateVal}>{year || 'YYYY'}</Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Ionicons name="warning" size={12} color="#FF3B30" />
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.checkRow} onPress={() => { hapticTouch(); setParental(!parental); }} activeOpacity={0.7}>
          <View style={[styles.checkbox, parental && styles.checkboxOn]}>
            {parental && <Ionicons name="checkmark" size={10} color="#020204" />}
          </View>
          <Text style={styles.checkLabel}>I confirm I am at least 16 or have parental consent.</Text>
        </TouchableOpacity>

        <View style={styles.infoStrip}>
          <Ionicons name="information-circle-outline" size={14} color="#555555" />
          <Text style={styles.infoText}>Date of birth is only used for age verification and is not stored separately.</Text>
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={verify} activeOpacity={0.8}>
          <LinearGradient colors={['#00F0FF', '#0072FF']} style={styles.nextGradient}>
            <Text style={styles.nextText}>CONTINUE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', justifyContent: 'center' },
  ambientGlow: {
    position: 'absolute', top: -height * 0.1, right: -width * 0.4,
    width: width, height: width, borderRadius: width / 2,
    backgroundColor: 'rgba(0, 240, 255, 0.01)',
  },
  inner: { paddingHorizontal: 28, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 12, color: '#8E8E93', textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  dateField: { alignItems: 'center' },
  dateLabel: {
    fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555', fontWeight: '800', letterSpacing: 1.5, marginBottom: 8,
  },
  dateBox: {
    width: 64, height: 44, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  dateBoxActive: { borderColor: 'rgba(0,240,255,0.2)' },
  dateVal: { fontSize: 15, color: '#D4D4D8', fontWeight: '600' },
  sep: { fontSize: 16, color: '#555555', marginBottom: 8 },
  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,59,48,0.06)', borderRadius: 8, padding: 10,
    borderLeftWidth: 2, borderLeftColor: '#FF3B30', marginBottom: 16,
  },
  errText: {
    fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF3B30', fontWeight: '800', flex: 1,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, paddingVertical: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#00F0FF', borderColor: '#00F0FF' },
  checkLabel: { fontSize: 12, color: '#D4D4D8', flex: 1, lineHeight: 17 },
  infoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 24, paddingHorizontal: 4,
  },
  infoText: { fontSize: 10, color: '#555555', flex: 1 },
  nextBtn: { width: '100%', borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  nextGradient: { paddingVertical: 16, alignItems: 'center' },
  nextText: {
    fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800', color: '#020204', letterSpacing: 1,
  },
});
