/**
 * Consent Manager — GDPR / ePrivacy Compliance
 * GDPR Art. 7(1): Controller shall demonstrate consent was given.
 * GDPR Art. 7(3): Withdrawal must be as easy as granting.
 */

import { kv } from './storage';
import { Logger } from './logger';

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

class ConsentManager {
  private readonly STORAGE_KEY = 'zerovault_consent_history';

  private getHistory(): ConsentHistory {
    const raw = kv.get(this.STORAGE_KEY);
    if (!raw) return { records: [], last_updated: '' };
    try {
      return JSON.parse(raw);
    } catch {
      Logger.warn('Consent history corrupted — resetting', { module: 'ConsentManager' });
      return { records: [], last_updated: '' };
    }
  }

  private save(history: ConsentHistory): void {
    kv.set(this.STORAGE_KEY, JSON.stringify(history));
  }

  grant(type: ConsentType, version?: string): void {
    const history = this.getHistory();
    const idx = history.records.findIndex((r) => r.consent_type === type && !r.withdrawal_timestamp);
    const record: ConsentRecord = { consent_type: type, granted: true, timestamp: new Date().toISOString(), version: version || undefined };

    if (idx >= 0) history.records[idx] = record;
    else history.records.push(record);

    history.last_updated = new Date().toISOString();
    this.save(history);
    Logger.info(`CONSENT GRANTED: ${type}`, { module: 'ConsentManager', consent_type: type });
  }

  withdraw(type: ConsentType): void {
    const history = this.getHistory();
    const record = history.records.find((r) => r.consent_type === type && !r.withdrawal_timestamp);
    if (record) {
      record.withdrawal_timestamp = new Date().toISOString();
      history.last_updated = new Date().toISOString();
      this.save(history);
      Logger.info(`CONSENT WITHDRAWN: ${type}`, { module: 'ConsentManager', consent_type: type });
    }
  }

  has(type: ConsentType): boolean {
    return this.getHistory().records.some((r) => r.consent_type === type && r.granted && !r.withdrawal_timestamp);
  }

  hasAcceptedCurrentPrivacyPolicy(currentVersion: string): boolean {
    return this.getHistory().records.some((r) => r.consent_type === 'privacy_policy' && r.granted && !r.withdrawal_timestamp && r.version === currentVersion);
  }

  getTimestamp(type: ConsentType): string | null {
    const record = this.getHistory().records.find((r) => r.consent_type === type && r.granted && !r.withdrawal_timestamp);
    return record?.timestamp || null;
  }

  getAllActive(): ConsentRecord[] {
    return this.getHistory().records.filter((r) => r.granted && !r.withdrawal_timestamp);
  }

  exportRecords(): ConsentHistory {
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
