# Records of Processing Activities (ROPA)
## GDPR Article 30 — Zero Vault

**Date:** 2026-05-25
**Controller:** Zero Vault (Romania, EU)
**DPO:** dpo@zerovault.app

---

## Processing Activities

### PA-001: Local Encrypted Storage

| Field | Value |
|-------|-------|
| Purpose | Encrypted storage of passwords, seed phrases, and notes on device |
| Legal basis | Local processing only (no transmission) |
| Data categories | Passwords, seed phrases, notes (XChaCha20 encrypted), metadata (titles, folders, icons) |
| Data subjects | Vault users |
| Recipients | None |
| Transfers | Not applicable |
| Retention | User-controlled (deleted on item deletion or vault purge) |
| Security | XChaCha20-Poly1305 encryption, SQLCipher AES-256, Argon2id key derivation |

### PA-002: Anonymous Cloud Sync

| Field | Value |
|-------|-------|
| Purpose | Encrypted multi-device synchronization |
| Legal basis | Art. 6(1)(a) — Consent (opt-in, user manually enables) |
| Data categories | Encrypted opaque ciphertext blocks (server cannot decrypt), anonymous user ID |
| Data subjects | Users who enable sync |
| Recipients | Supabase, Upstash Redis |
| Transfers | EU (Ireland/Frankfurt) |
| Retention | Until account deletion or vault purge |
| Security | XChaCha20 per-push DEK wrapping, HMAC hash chain verification |

### PA-003: Identity Upgrade

| Field | Value |
|-------|-------|
| Purpose | Link anonymous account to email for cross-device access |
| Legal basis | Art. 6(1)(b) — Contractual necessity |
| Data categories | Email address, hashed password |
| Data subjects | Users who upgrade identity |
| Recipients | Supabase Auth |
| Transfers | EU |
| Retention | Until account deletion |
| Security | Supabase Auth industry standard |

### PA-004: Consent Records

| Field | Value |
|-------|-------|
| Purpose | Legal proof of consent (Art. 7(1)) |
| Legal basis | Art. 6(1)(c) — Legal obligation |
| Data categories | Consent type, timestamp, version, withdrawal timestamp |
| Data subjects | All users |
| Recipients | None |
| Transfers | Not applicable |
| Retention | 5 years after withdrawal |
| Security | Locally stored in MMKV |

### PA-005: Audit Logging

| Field | Value |
|-------|-------|
| Purpose | Compliance and security auditing |
| Legal basis | Art. 6(1)(f) — Legitimate interests |
| Data categories | Event type, timestamp, module (no payload data) |
| Data subjects | All users |
| Recipients | None |
| Transfers | Not applicable |
| Retention | 2000 in-memory / 1000 persisted (auto-rotating) |
| Security | Locally stored; sanitized |

---

## Summary

| PA-ID | Purpose | Basis | Third-Party | Retention |
|-------|---------|-------|-------------|-----------|
| PA-001 | Local storage | Local only | None | User-controlled |
| PA-002 | Cloud sync | 6(1)(a) | Supabase, Upstash | Until deletion |
| PA-003 | Identity upgrade | 6(1)(b) | Supabase Auth | Until deletion |
| PA-004 | Consent records | 6(1)(c) | None | 5 years |
| PA-005 | Audit logging | 6(1)(f) | None | Rotating |

---

**Maintained by:** Zero Vault DPO (dpo@zerovault.app)
**Last updated:** May 25, 2026
**Next review:** May 25, 2027
