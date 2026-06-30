/**
 * Consent Manager — GDPR / ePrivacy Compliance
 * GDPR Art. 7(1): Controller shall demonstrate consent was given.
 * GDPR Art. 7(3): Withdrawal must be as easy as granting.
 */

import { kv } from './storage';
import { Logger } from './logger';
import * as Crypto from 'expo-crypto';

export type ConsentType = 'terms_of_use' | 'privacy_policy' | 'cloud_sync' | 'analytics' | 'crash_reporting';

export interface ConsentRecord {
  consent_type: ConsentType;
  granted: boolean;
  timestamp: string;
  version?: string;
  withdrawal_timestamp?: string;
}

export interface ConsentHistory {
  records: ConsentRecord[];
  last_updated: string;
}

let _hmacKey: string | null = null;

async function getHmacKey(): Promise<string> {
  if (_hmacKey) return _hmacKey;
  try {
    const { default: SecureStore } = await import('expo-secure-store');
    let key = await SecureStore.getItemAsync('zerovault_consent_hmac_key');
    if (!key) {
      key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `zerovault-consent-${Date.now()}-${Math.random()}`);
      await SecureStore.setItemAsync('zerovault_consent_hmac_key', key);
    }
    _hmacKey = key;
  } catch {
    _hmacKey = 'zerovault-fallback';
  }
  return _hmacKey;
}

async function sign(payload: string): Promise<string> {
  const key = await getHmacKey();
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key + payload);
}

class ConsentManager {
  private readonly STORAGE_KEY = 'zerovault_consent_history';

  private async getHistory(): Promise<ConsentHistory> {
    const raw = kv.get(this.STORAGE_KEY);
    if (!raw) return { records: [], last_updated: '' };
    try {
      const { payload, signature } = JSON.parse(raw);
      const expected = await sign(payload);
      if (expected !== signature) {
        Logger.warn('SECURITY: Consent data tampering detected — resetting', { module: 'ConsentManager' });
        kv.delete(this.STORAGE_KEY);
        return { records: [], last_updated: '' };
      }
      const history: ConsentHistory = JSON.parse(payload);
      if (!history || !Array.isArray(history.records)) return { records: [], last_updated: '' };
      return history;
    } catch {
      Logger.warn('Consent history corrupted — resetting', { module: 'ConsentManager' });
      return { records: [], last_updated: '' };
    }
  }

  private async save(history: ConsentHistory): Promise<void> {
    const payload = JSON.stringify(history);
    const signature = await sign(payload);
    kv.set(this.STORAGE_KEY, JSON.stringify({ payload, signature }));
  }

  async grant(type: ConsentType, version?: string): Promise<void> {
    const history = await this.getHistory();
    const idx = history.records.findIndex((r) => r.consent_type === type && !r.withdrawal_timestamp);
    const record: ConsentRecord = { consent_type: type, granted: true, timestamp: new Date().toISOString(), version: version || undefined };
    if (idx >= 0) history.records[idx] = record;
    else history.records.push(record);
    history.last_updated = new Date().toISOString();
    await this.save(history);
    Logger.info(`CONSENT GRANTED: ${type}`, { module: 'ConsentManager', consent_type: type });
  }

  async withdraw(type: ConsentType): Promise<void> {
    const history = await this.getHistory();
    const record = history.records.find((r) => r.consent_type === type && !r.withdrawal_timestamp);
    if (record) {
      record.withdrawal_timestamp = new Date().toISOString();
      history.last_updated = new Date().toISOString();
      await this.save(history);
      Logger.info(`CONSENT WITHDRAWN: ${type}`, { module: 'ConsentManager', consent_type: type });
    }
  }

  async has(type: ConsentType): Promise<boolean> {
    const history = await this.getHistory();
    return history.records.some((r) => r.consent_type === type && r.granted && !r.withdrawal_timestamp);
  }

  async hasAcceptedCurrentPrivacyPolicy(currentVersion: string): Promise<boolean> {
    const history = await this.getHistory();
    return history.records.some((r: ConsentRecord) => r.consent_type === 'privacy_policy' && r.granted && !r.withdrawal_timestamp && r.version === currentVersion);
  }

  async getTimestamp(type: ConsentType): Promise<string | null> {
    const history = await this.getHistory();
    const record = history.records.find((r: ConsentRecord) => r.consent_type === type && r.granted && !r.withdrawal_timestamp);
    return record?.timestamp || null;
  }

  async getAllActive(): Promise<ConsentRecord[]> {
    const history = await this.getHistory();
    return history.records.filter((r: ConsentRecord) => r.granted && !r.withdrawal_timestamp);
  }

  async exportRecords(): Promise<ConsentHistory> {
    return this.getHistory();
  }

  resetAll(): void {
    kv.delete(this.STORAGE_KEY);
  }

  getAgeVerified(): boolean {
    return kv.get('zerovault_age_verified') === 'true';
  }

  setAgeVerified(dob: string): void {
    kv.set('zerovault_age_verified', 'true');
    kv.set('zerovault_dob', dob);
  }

  calculateAge(dob: string): number {
    const bd = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - bd.getFullYear();
    const m = now.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
    return age;
  }

  isUnderAge(dob: string, min: number = 16): boolean {
    return this.calculateAge(dob) < min;
  }
}

export const consentManager = new ConsentManager();
