/**
 * GDPR Compliance Constants — Zero Vault
 * EU General Data Protection Regulation (GDPR) 2016/679
 */

export const GDPR = {
  DATA_CONTROLLER: {
    name: 'Zero Vault',
    legal_form: 'Individual Entrepreneur / PFA',
    email: 'legal@zerovault.app',
    privacy_email: 'privacy@zerovault.app',
    website: 'https://zerovault.app',
    country: 'Romania (EU)',
  },

  DPO: {
    name: 'Zero Vault Data Protection Officer',
    email: 'dpo@zerovault.app',
  },

  SUPERVISORY_AUTHORITY: {
    name: 'Autoritatea Nationala de Supraveghere a Prelucrarii Datelor cu Caracter Personal (ANSPDCP)',
    short_name: 'ANSPDCP',
    country: 'Romania',
    website: 'https://www.dataprotection.ro',
    phone: '+40 318 059 211',
    email: 'anspdcp@dataprotection.ro',
    address: 'B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, Bucuresti, Romania',
  },

  LEGAL_BASES: {
    consent: 'GDPR Art. 6(1)(a)',
    contract: 'GDPR Art. 6(1)(b)',
    legal_obligation: 'GDPR Art. 6(1)(c)',
    legitimate_interest: 'GDPR Art. 6(1)(f)',
  },

  DATA_SUBJECT_RIGHTS: [
    { article: 'Art. 15', right: 'Right of access' },
    { article: 'Art. 16', right: 'Right to rectification' },
    { article: 'Art. 17', right: 'Right to erasure (right to be forgotten)' },
    { article: 'Art. 18', right: 'Right to restriction of processing' },
    { article: 'Art. 19', right: 'Right to notification regarding rectification/erasure/restriction' },
    { article: 'Art. 20', right: 'Right to data portability' },
    { article: 'Art. 21', right: 'Right to object' },
    { article: 'Art. 22', right: 'Right not to be subject to automated decision-making' },
    { article: 'Art. 7(3)', right: 'Right to withdraw consent at any time' },
  ],

  PROCESSING_ACTIVITIES: {
    local_storage: {
      purpose: 'Local encrypted storage of passwords, seed phrases, and secure notes',
      data: 'Encrypted vault items (passwords, seed phrases, notes) with metadata (titles, folders, icons)',
      basis: 'Local processing only — no server transmission',
      retention: 'User-controlled; deleted on item deletion or vault purge',
      third_parties: 'None',
      encryption: 'XChaCha20-Poly1305 per-item encryption, SQLCipher AES-256 at rest, Argon2id PIN derivation',
    },
    sync_service: {
      purpose: 'Encrypted cloud synchronization across devices',
      data: 'Encrypted opaque ciphertext blobs (server cannot decrypt), anonymous user ID',
      basis: 'GDPR Art. 6(1)(a) — Consent (opt-in, user-manually enables sync)',
      retention: 'Until account deletion or vault purge',
      third_parties: 'Supabase (PostgreSQL, Auth), Upstash Redis (cache)',
    },
    identity_upgrade: {
      purpose: 'Link anonymous account to email for cross-device access',
      data: 'Email address, hashed password (Supabase Auth)',
      basis: 'GDPR Art. 6(1)(b) — Contractual necessity',
      retention: 'Until account deletion',
      third_parties: 'Supabase Auth',
    },
    consent_records: {
      purpose: 'Legal proof of consent (GDPR Art. 7(1))',
      data: 'Consent type, timestamp, version, withdrawal timestamp',
      basis: 'GDPR Art. 6(1)(c) — Legal obligation',
      retention: '5 years after consent withdrawal',
      third_parties: 'None',
    },
    audit_logging: {
      purpose: 'Compliance and security auditing',
      data: 'Event type, timestamp, module (sanitized, no payload data)',
      basis: 'GDPR Art. 6(1)(f) — Legitimate interests',
      retention: '2000 in-memory entries, 1000 persisted (auto-rotating)',
      third_parties: 'None',
    },
  },

  THIRD_PARTY_PROCESSORS: [
    {
      name: 'Supabase',
      purpose: 'Encrypted database, anonymous authentication, identity upgrade',
      location: 'EU (Ireland / Frankfurt)',
      dpa_url: 'https://supabase.com/docs/legal/privacy',
      gdpr_compliance: 'GDPR-compliant, EU SCCs available',
    },
    {
      name: 'Upstash Redis',
      purpose: 'Server-side caching (encrypted records only)',
      location: 'EU (Frankfurt)',
      dpa_url: 'https://upstash.com/legal/privacy',
      gdpr_compliance: 'GDPR-compliant',
    },
  ],

  DATA_RETENTION: {
    vault_items: 'Until user deletion or vault purge (user-controlled)',
    sync_log: 'Until account deletion (immutable journal)',
    consent_records: '5 years after consent withdrawal',
    audit_log: '2000 in-memory / 1000 persisted (auto-rotating)',
    pin_attempts: 'User-settable (default 5, then lockout)',
  },

  BREACH_NOTIFICATION: {
    supervisory_authority_deadline: '72 hours (GDPR Art. 33)',
    data_subject_deadline: 'Without undue delay if high risk (GDPR Art. 34)',
    breach_log_retention: '5 years',
  },

  AGE_RESTRICTION: {
    minimum_age: '16 years (GDPR Art. 8)',
    under_16_requires: 'Parental consent',
  },

  PRIVACY_POLICY: {
    current_version: '1.0.0',
    effective_date: '2026-05-25',
    last_updated: '2026-05-25',
  },

  CONSENT_TYPES: {
    terms_of_use: 'Acceptance of Terms of Use',
    privacy_policy: 'Acceptance of Privacy Policy',
    cloud_sync: 'Consent for encrypted cloud synchronization',
  },

  MDR: {
    applicable: false,
    note: 'Zero Vault is a password manager / crypto vault. It does not store or process health data and is NOT a medical device under EU MDR 2017/745.',
  },
};
