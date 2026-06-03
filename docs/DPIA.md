# Data Protection Impact Assessment (DPIA)
## GDPR Article 35 — Zero Vault

**Date:** 2026-05-25
**Controller:** Zero Vault (Romania, EU)
**DPO:** dpo@zerovault.app

---

## 1. DPIA Rationale

Under GDPR Article 35, a DPIA is required when processing is "likely to result in a high risk to the rights and freedoms of natural persons."

| GDPR Art. 35(3) Trigger | Assessment |
|--------------------------|------------|
| (a) Systematic profiling | NOT APPLICABLE |
| (b) Large-scale special category data (Art. 9) | NOT APPLICABLE (no health data) |
| (c) Systematic public monitoring | NOT APPLICABLE |

Zero Vault processes passwords, seed phrases, and notes. These are NOT special category data under Art. 9. However, a DPIA is conducted as a best practice given the sensitivity of credential storage and the zero-knowledge architecture.

---

## 2. Processing Description

### Nature
Zero Vault is a zero-knowledge password manager and encrypted vault for storing passwords, blockchain seed phrases, and secure notes.

### Scope
- **Data subjects:** Individual users
- **Data categories:** Encrypted passwords, seed phrases, notes, metadata (titles, folders, icons)
- **Geographic scope:** EU (primary), global (secondary)
- **Scale:** Small to medium (individual users with personal vaults)

### Context
- Direct controller-to-data-subject relationship
- Users maintain full control (data created/edited/deleted by user)
- Zero-knowledge — server cannot access plaintext data
- Optional cloud sync (opt-in, user-initiated)

### Purposes
1. Local encrypted storage of credentials, seeds, and notes
2. Optional encrypted multi-device synchronization
3. Anonymous identity management

### Technical Implementation
- **Local storage:** WatermelonDB with SQLCipher AES-256
- **Encryption:** XChaCha20-Poly1305 per-item, Argon2id PIN derivation (128MB, 6 passes)
- **Server:** Zero-knowledge (opaque ciphertext blocks only)
- **Authentication:** PIN-based (8+ digits) with biometric optional

---

## 3. Necessity & Proportionality

| Processing | Necessary | Proportional |
|-----------|-----------|--------------|
| Local encryption | Yes (core function) | Data stays on device |
| Cloud sync | Yes when enabled | Encrypted only; server sees ciphertext |
| Identity upgrade | Yes for cross-device | Email only; everything else encrypted |

---

## 4. Risk Assessment

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|-----------|
| Server breach | Very Low | Low | Zero-knowledge — only encrypted blocks |
| Device theft | Low | Medium | SQLCipher + PIN lock + background wipe |
| PIN brute-force | Very Low | Medium | Argon2id (128MB, 6 passes per attempt), 5-attempt lockout |
| Insider threat | Very Low | Very Low | Zero-knowledge — no plaintext access possible |
| Loss of PIN | Medium | Medium | Clear warnings; cross-device recovery seeds |
| Third-party processor breach | Low | Low | Encrypted data only; DPAs in place |

**Overall residual risk:** LOW

---

## 5. Mitigation Measures

### Technical
- XChaCha20-Poly1305 authenticated encryption
- Argon2id memory-hard key derivation (128MB, 6 passes, 4 lanes)
- SQLCipher AES-256 at-rest database encryption
- Hardware-backed Secure Enclave (iOS Keychain / Android Keystore)
- Zero-knowledge protocol (server cannot decrypt)
- HMAC-SHA256 hash chain verification for sync integrity
- Explicit key zeroing after use

### Organizational
- DPO appointed (dpo@zerovault.app)
- DPA agreements with processors
- 72-hour breach notification protocol
- GDPR Art. 17 erasure (Purge Enclave)
- Consent management with records
- Audit logging (sanitized, no payload data)

---

## 6. DPO Consultation

The DPO (dpo@zerovault.app) was consulted and has approved the risk mitigation measures.

---

## 7. Data Subject Consultation

Formal consultation was deemed disproportionate given:
- Zero-knowledge architecture (no plaintext access by controller)
- All processing is user-controlled
- No processing of special category data
- Residual risk assessed as LOW

---

## 8. Supervisory Authority Consultation

Not required (residual risk LOW). Would consult ANSPDCP if residual risk were high.

---

## 9. Review Schedule

- Initial: May 2026
- Next: May 2027 (annual)
- Triggers: Material processing change, new processors, data breach, regulatory change

---

## 10. Conclusion

Zero Vault's zero-knowledge architecture provides a fundamentally strong privacy posture. Processing is limited, proportional, and user-controlled. Residual risk is LOW.

**Signed:** Zero Vault DPO | **Date:** May 25, 2026
