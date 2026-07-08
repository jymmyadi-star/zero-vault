import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, Dimensions, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useVaultStore } from '../../lib/store/vault-store';
import { isSupabaseConfigured } from '../../lib/supabase';
import { enableSync, disableSync } from '../../lib/sync/index';
import { isIdentityLinked } from '../../lib/sync/identity';
import { kv } from '../../lib/storage';
import { purgeVault } from '../../lib/crypto/vault-keychain';
import { purgeV2Database as purgeDatabase } from '../../lib/db/database-v2';
import { hapticTouch, hapticSuccess, hapticWarning } from '../../lib/haptics';
import { exportVault } from '../../lib/vault-export';
import { rotateKeys } from '../../lib/key-rotation';

const IDLE_TIMEOUT_KEY = 'zerovault_idle_timeout_minutes';
const TIMEOUT_OPTIONS = [
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: 'Never', value: 0 },
];

const { width, height } = Dimensions.get('window');

export default function SettingsScreen() {
  const { lock, syncEnabled, syncStatus, lastSyncAt } = useVaultStore();
  const [identityLinked, setIdentityLinked] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(
    kv.get('zerovault_biometric_enabled') === 'true',
  );
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    const stored = kv.get(IDLE_TIMEOUT_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      return isNaN(parsed) ? 5 : parsed;
    }
    return 5;
  });
  const [isRotating, setIsRotating] = useState(false);
  const [rotationProgress, setRotationProgress] = useState<{ current: number; total: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleSetAutoLock = (minutes: number) => {
    hapticTouch();
    if (minutes === 0) {
      kv.delete(IDLE_TIMEOUT_KEY);
    } else {
      kv.set(IDLE_TIMEOUT_KEY, minutes.toString());
    }
    setAutoLockMinutes(minutes);
  };

  const handleExport = (format: 'bitwarden-json' | 'csv') => {
    hapticWarning();
    Alert.alert(
      'Export Vault',
      `This will export all your passwords as decrypted ${format === 'bitwarden-json' ? 'Bitwarden JSON' : 'CSV'}. Keep this file secure and delete it after importing.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          style: 'destructive',
          onPress: async () => {
            setIsExporting(true);
            try {
              const result = await exportVault({ format });
              const Share = require('react-native').Share;
              await Share.share({
                message: result.data,
                title: `ZeroVault Export — ${result.itemCount} items`,
              });
              hapticSuccess();
            } catch (err: any) {
              hapticWarning();
              Alert.alert('Export Failed', err.message);
            } finally {
              setIsExporting(false);
            }
          },
        },
      ],
    );
  };

  const handleRotateKeys = () => {
    hapticWarning();
    Alert.prompt(
      'Rotate Cryptographic Keys',
      'Enter your Master Password to confirm. All vault items will be re-encrypted with new keys. This may take a moment.',
      async (pin) => {
        if (!pin || pin.length < 8) {
          Alert.alert('Invalid Password', 'Password must be at least 8 characters.');
          return;
        }
        setIsRotating(true);
        setRotationProgress(null);
        try {
          const result = await rotateKeys(pin, (current, total) => {
            setRotationProgress({ current, total });
          });
          hapticSuccess();
          Alert.alert(
            'Keys Rotated ✓',
            `${result.reEncryptedCount} items re-encrypted. New epoch: ${result.newEpochId}.`,
          );
        } catch (err: any) {
          hapticWarning();
          Alert.alert('Rotation Failed', err.message);
        } finally {
          setIsRotating(false);
          setRotationProgress(null);
        }
      },
      'secure-text',
    );
  };

  const handlePurgeAllData = () => {
    hapticWarning();
    Alert.alert(
      '⚠️ PURGE ALL DATA',
      'This action is irreversible and complies with GDPR Right to Be Forgotten. All cryptographic items, master credentials, salts, and local storage configurations will be completely and permanently wiped from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm Purge', 
          style: 'destructive', 
          onPress: async () => {
            hapticWarning();
            try {
              await purgeDatabase();
              await purgeVault();
            } catch (err: any) {
              Alert.alert('Purge Failure', `Failed to purge: ${err.message}`);
              return;
            }

            const keys = kv.getAllKeys();
            for (const key of keys) {
              kv.delete(key);
            }

            Alert.alert(
              'Purge Successful',
              'All data has been wiped from this device. The app will restart in genesis mode.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    const { lock } = useVaultStore.getState();
                    lock();
                    useVaultStore.getState().setStatus('setup_required');
                  },
                },
              ],
            );
          } 
        },
      ],
    );
  };

  useEffect(() => {
    if (syncEnabled) {
      isIdentityLinked().then(setIdentityLinked);
    } else {
      setIdentityLinked(false);
    }
  }, [syncEnabled]);

  const handleToggleBiometric = async (value: boolean) => {
    hapticTouch();
    if (value) {
      try {
        const LocalAuth = require('expo-local-authentication');
        const hasHardware = await LocalAuth.hasHardwareAsync();
        const isEnrolled = await LocalAuth.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          hapticWarning();
          Alert.alert(
            'Biometric Unavailable',
            'Your device does not support biometric authentication or no biometric data is enrolled.',
          );
          return;
        }

        const result = await LocalAuth.authenticateAsync({
          promptMessage: 'Enable biometric unlock',
          fallbackLabel: 'Use PIN',
        });

        if (result.success) {
          kv.set('zerovault_biometric_enabled', 'true');
          setBiometricEnabled(true);
          await hapticSuccess();
        }
      } catch {
        Alert.alert('Error', 'Could not enable biometric authentication.');
      }
    } else {
      kv.set('zerovault_biometric_enabled', 'false');
      setBiometricEnabled(false);
    }
  };

  const handleLock = () => {
    hapticWarning();
    Alert.alert('Lock Vault', 'The vault will be locked and sensitive keys will be wiped from memory.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', style: 'destructive', onPress: () => { hapticTouch(); lock(); } },
    ]);
  };

  const handleToggleSync = (value: boolean) => {
    hapticTouch();
    if (value) {
      Alert.alert(
        'Enable Cloud Backup',
        'Your encrypted vault data will be synced to the cloud using an anonymous account. The server never sees your plaintext data — everything is encrypted with your Master Password before leaving this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              const ok = await enableSync();
              if (ok) {
                await hapticSuccess();
              } else {
                hapticWarning();
                Alert.alert(
                  'Sync Unavailable',
                  'Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY to your .env file.',
                );
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Disable Cloud Backup',
        'New changes will no longer sync to the cloud. Existing synced data remains on the server.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => {
              disableSync();
              hapticSuccess();
            },
          },
        ],
      );
    }
  };

  const syncStatusLabel = () => {
    switch (syncStatus) {
      case 'syncing': return 'Syncing...';
      case 'secured': return lastSyncAt ? `Synced ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Secured';
      case 'error': return 'Sync error';
      case 'offline': return 'Offline';
      default: return 'Not syncing';
    }
  };

  return (
    <View style={styles.container}>

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <LinearGradient 
          colors={['#000000', '#1A040B', '#3A0A11', '#4D0E1A', '#1A040B', '#000000']} 
          locations={[0, 0.2, 0.45, 0.75, 0.95, 1]}
          style={StyleSheet.absoluteFillObject} 
        />
        <LinearGradient 
          colors={['#000000', '#000000', 'transparent']} 
          locations={[0, 0.4, 1]}
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' }} 
        />
        <LinearGradient 
          colors={['transparent', '#000000', '#000000']} 
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 0 }}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%' }} 
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.hudTag}>[ ENCLAVE ORCHESTRATOR ]</Text>
          <Text style={styles.title}>System Control</Text>
        </View>

        {/* SECTION 1: SECURITY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ SECURITY PROFILES ]</Text>
          
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/change-pin')}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="key-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Change Master Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="finger-print-outline" size={20} color={biometricEnabled ? '#FFFFFF' : '#8E8E93'} />
                <Text style={styles.rowLabel}>Biometric Authorization</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: 'rgba(255, 255, 255, 0.05)', true: 'rgba(255, 255, 255, 0.15)' }}
                thumbColor={biometricEnabled ? '#FFFFFF' : '#52525b'}
              />
            </View>

            <View style={styles.divider} />

            <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: 16 }]}>
              <View style={[styles.rowLeft, { marginBottom: 12 }]}>
                <Ionicons name="timer-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Auto-Lock Timeout</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 32 }}>
                {TIMEOUT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => handleSetAutoLock(opt.value)}
                    style={[
                      styles.timeoutChip,
                      autoLockMinutes === opt.value && styles.timeoutChipActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.timeoutChipText,
                      autoLockMinutes === opt.value && styles.timeoutChipTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.row} onPress={handleLock} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Ionicons name="lock-closed-outline" size={20} color="#FF3B30" />
                <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>Halt & Lock Vault</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION: CLOUD SYNC */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ CLOUD BACKUP & EXTENSION LINK ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="cloud-outline" size={20} color={syncEnabled ? '#00F0FF' : '#8E8E93'} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Enable Cloud Sync</Text>
                  <Text style={styles.syncStatusText}>ALLOWS PAIRING WITH BROWSER EXTENSION</Text>
                </View>
              </View>
              <Switch
                value={syncEnabled}
                onValueChange={(val) => {
                  import('../../lib/consent-manager').then(m => m.consentManager.grant('cloud_sync').then(() => handleToggleSync(val)));
                }}
                trackColor={{ false: 'rgba(255, 255, 255, 0.05)', true: 'rgba(0, 240, 255, 0.3)' }}
                thumbColor={syncEnabled ? '#00F0FF' : '#52525b'}
              />
            </View>

            <View style={styles.divider} />
            
            <View style={styles.row}>
               <View style={styles.rowLeft}>
                 <Ionicons name="swap-vertical" size={20} color="#FFFFFF" />
                 <Text style={styles.rowLabel}>Sync Status</Text>
               </View>
               <Text style={styles.rowValue}>{syncStatusLabel()}</Text>
            </View>
          </View>
        </View>

        {/* SECTION: DATA MIGRATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ DATA MIGRATION ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/import-vault' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="download-outline" size={20} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Import Vault</Text>
                  <Text style={styles.syncStatusText}>BITWARDEN // 1PASSWORD // CHROME // CSV</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION: DATA EXPORT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ DATA PORTABILITY ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={[styles.row, { opacity: isExporting ? 0.5 : 1 }]}
              onPress={() => handleExport('bitwarden-json')}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="cloud-download-outline" size={20} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Export as Bitwarden JSON</Text>
                  <Text style={styles.syncStatusText}>COMPATIBLE WITH BITWARDEN • 1PASSWORD • KEEPASS</Text>
                </View>
              </View>
              {isExporting
                ? <ActivityIndicator size="small" color="#8E8E93" />
                : <Ionicons name="chevron-forward" size={16} color="#52525b" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.row, { opacity: isExporting ? 0.5 : 1 }]}
              onPress={() => handleExport('csv')}
              disabled={isExporting}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Export as CSV</Text>
                  <Text style={styles.syncStatusText}>GENERIC FORMAT • EXCEL • GOOGLE SHEETS</Text>
                </View>
              </View>
              {isExporting
                ? <ActivityIndicator size="small" color="#8E8E93" />
                : <Ionicons name="chevron-forward" size={16} color="#52525b" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            EXPORTED DATA IS UNENCRYPTED. TREAT IT AS SENSITIVE. DELETE AFTER USE.
          </Text>
        </View>

        {/* SECTION: CRYPTOGRAPHIC SECURITY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ CRYPTOGRAPHIC SECURITY ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={[styles.row, { opacity: isRotating ? 0.5 : 1 }]}
              onPress={handleRotateKeys}
              disabled={isRotating}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="refresh-circle-outline" size={20} color="#FF9F0A" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: '#FF9F0A' }]}>Rotate Cryptographic Keys</Text>
                  <Text style={styles.syncStatusText}>
                    {isRotating && rotationProgress
                      ? `RE-ENCRYPTING ${rotationProgress.current}/${rotationProgress.total}...`
                      : 'GENERATES NEW CIPHERKEY • SIGNKEY • RE-ENCRYPTS ALL ITEMS'}
                  </Text>
                </View>
              </View>
              {isRotating
                ? <ActivityIndicator size="small" color="#FF9F0A" />
                : <Ionicons name="chevron-forward" size={16} color="#52525b" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            USE IF YOU SUSPECT YOUR KEYS HAVE BEEN COMPROMISED. YOUR PIN DOES NOT CHANGE.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ COMPILER INFO ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Zero-Knowledge Enclave Core</Text>
              </View>
              <Text style={styles.rowValue}>v1.0.0 // PRODUCTION</Text>
            </View>
          </View>
        </View>

        {/* SECTION 4: COMPLIANCE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ COMPLIANCE & PRIVACY ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/compliance' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#00F0FF" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>GDPR Compliance Center</Text>
                  <Text style={styles.syncStatusText}>RIGHTS MANAGEMENT // DATA PORTABILITY // DPO CONTACT</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/privacy-policy' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/terms?mode=view' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="document-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Terms of Use</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/cookie-consent' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Ionicons name="cube-outline" size={20} color="#FFFFFF" />
                <Text style={styles.rowLabel}>Cookie & Tracking</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#52525b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 5: GDPR PURGE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>[ COMPLIANCE & PRIVACY ]</Text>
          <View style={styles.pod}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(3, 0, 2, 0.1)', 'rgba(3, 0, 2, 0.98)']} style={StyleSheet.absoluteFill} />
            <TouchableOpacity style={styles.row} onPress={handlePurgeAllData} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Ionicons name="trash-bin-outline" size={20} color="#FF3B30" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: '#FF3B30' }]}>Purge Enclave (GDPR)</Text>
                  <Text style={styles.syncStatusText}>RIGHT TO BE FORGOTTEN // PERMANENT DELETION</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#FF3B30" opacity={0.5} />
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            IN ACCORDANCE WITH EU GDPR ARTICLE 17 (RIGHT TO ERASURE), COMMITTING A PURGE INSTANTLY SCRUBBERS AND SHREDDERS ALL CRYPTOGRAPHIC DATA AND KEYS NATIVELY. THIS OPERATION CANNOT BE UNDONE.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 28,
  },
  hudTag: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  pod: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 0, 50, 0.15)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '700',
  },
  syncStatusText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.5,
  },
  hint: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#555555',
    lineHeight: 15,
    marginTop: 10,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  timeoutChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  timeoutChipActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  timeoutChipText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FF0033',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timeoutChipTextActive: {
    color: '#FFFFFF',
  },
});
