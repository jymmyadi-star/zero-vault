/**
 * Data Breach Notification Protocol
 * GDPR Art. 33: Notify supervisory authority within 72 hours
 * GDPR Art. 34: Notify affected data subjects if high risk
 */

import { Logger } from './logger';
import { GDPR } from '../constants/gdpr';
import { kv } from './storage';

export interface BreachRecord {
  id: string;
  discovered_at: string;
  description: string;
  categories: string[];
  records_affected: number;
  consequences: string;
  measures_taken: string;
  notified_authority: boolean;
  notified_subjects: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'contained' | 'notified' | 'remediated' | 'closed';
}

class DataBreachManager {
  private readonly KEY = 'zerovault_breach_log';

  getLog(): BreachRecord[] {
    const raw = kv.get(this.KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }

  log(record: Omit<BreachRecord, 'id' | 'discovered_at' | 'status' | 'notified_authority' | 'notified_subjects'>): BreachRecord {
    const breach: BreachRecord = {
      ...record,
      id: `BR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      discovered_at: new Date().toISOString(),
      status: 'investigating',
      notified_authority: false,
      notified_subjects: false,
    };

    const log = this.getLog();
    log.push(breach);
    kv.set(this.KEY, JSON.stringify(log));

    Logger.error('DATA BREACH LOGGED', { breach_id: breach.id, severity: breach.severity, module: 'DataBreachManager' });

    return breach;
  }

  update(id: string, update: Partial<Omit<BreachRecord, 'id' | 'discovered_at'>>): BreachRecord | null {
    const log = this.getLog();
    const idx = log.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    const existing = log[idx];
    if (!existing) return null;
    log[idx] = { ...existing, ...update, id: existing.id } as BreachRecord;
    kv.set(this.KEY, JSON.stringify(log));
    return log[idx] || null;
  }

  getAuthority() { return GDPR.SUPERVISORY_AUTHORITY; }
  getDeadline() { return 72; }
  exportLog() { return this.getLog(); }
}

export const dataBreachManager = new DataBreachManager();
