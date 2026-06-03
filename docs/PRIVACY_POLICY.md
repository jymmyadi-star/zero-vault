# Privacy Policy — Zero Vault

**Last Updated:** May 2026  
**Data Controller:** Developer, Romania, EU  
**Contact:** privacy@zerovault.app

---

## 1. Our Promise

**Zero Vault is designed so that we cannot access your data.** Every password, seed phrase, and note you store is encrypted on your device using XChaCha20-Poly1305 before it ever leaves your phone. We never receive your encryption keys, PIN, or recovery phrase.

**We cannot decrypt your data. We cannot recover your data. We cannot be compelled to produce your data.** This is not a policy choice — it is a mathematical property of our zero-knowledge architecture.

---

## 2. What We CANNOT Access (Zero-Knowledge Content)

All content you store in the Application — passwords, seed phrases, notes, TOTP secrets, metadata you create — is encrypted on your device before transmission using XChaCha20-Poly1305 encryption with keys derived from your PIN via Argon2id.

**Under this architecture, we do NOT and CANNOT collect, access, or process:**
- Your passwords, usernames, or login credentials
- Your seed phrases, private keys, or cryptocurrency wallet data
- Your secure notes or any text content you store
- Your TOTP secrets and generated authentication codes
- The URLs or services associated with your stored items
- Your organizational folders, categories, or labels you create
- Your recovery phrase (generated and stored on your device)
- Your PIN (verified locally via Argon2id, never transmitted)

All such content is encrypted ciphertext to us — random data indistinguishable from noise.

---

## 3. What We DO Collect

**Account Data (minimal):**
- Anonymous user identifier (Supabase anonymous auth)
- Optional: email address (only if you choose to link for cross-device sync recovery)
- Optional: hashed password (if you create an identity-linked account)

**Service Data (necessary for sync):**
- Encrypted vault data (ciphertext only — we cannot decrypt)
- Encrypted metadata (ciphertext only)
- Sync version vectors and hash chains for conflict resolution
- WebSocket connection for real-time sync notifications

**Device Data (de-identified):**
- App version and OS version (for compatibility and crash diagnostics)
- Language preference

**Diagnostic Data (optional, opt-in only):**
- Anonymous crash reports (if you opt in via device settings)
- We NEVER link diagnostic data to your vault content

---

## 4. Data We Explicitly Do NOT Collect

| Data Type | Collection Status |
|-----------|-------------------|
| Precise geolocation | ❌ Never collected |
| Device contacts or call logs | ❌ Never collected |
| Browsing history or website visits | ❌ Never collected |
| Biometric data (FaceID/TouchID) | ❌ Handled entirely on-device by Apple/Google |
| Advertising identifiers | ❌ Never collected (no ads in the Application) |
| Any plaintext vault content | ❌ Never accessible to us |
| Your recovery phrase or PIN | ❌ Never transmitted or stored |

---

## 5. Legal Basis for Processing

| Data Category | Legal Basis (GDPR) |
|---------------|---------------------|
| Encrypted sync data (ciphertext) | Art. 6(1)(b) — Contractual necessity (to provide synchronization) |
| Anonymous user identifier | Art. 6(1)(b) — Contractual necessity (authentication) |
| Email address (if provided) | Art. 6(1)(a) — Explicit consent |
| Diagnostic data (if opted in) | Art. 6(1)(a) — Explicit consent |
| App version, OS version | Art. 6(1)(f) — Legitimate interest (compatibility, security) |

**Regarding the encrypted content:** As established above, we process only ciphertext. Under GDPR Art. 4(1), "personal data" means "any information relating to an identified or identifiable natural person." Encrypted ciphertext on our servers relates to no identifiable person without the decryption keys that we do not possess. The content of your vault, from our perspective as a blind custodian, is not personal data we can process.

Should any supervisory authority determine otherwise, any special category data you choose to store (Art. 9) is processed exclusively by you on your device. We are not the controller of that data.

---

## 6. Data Storage and Encryption

**Architecture:**
- **At rest (device):** XChaCha20-Poly1305, Argon2id key derivation, keys stored in hardware-backed secure storage
- **In transit:** TLS 1.3 for all network communications
- **At rest (server):** Data is already ciphertext from client-side encryption — we apply no additional server-side encryption as the data is already cryptographically protected
- **Memory safety:** SecureBuffer with zero-on-dispose for all sensitive plaintext during key operations

**Infrastructure:** All server infrastructure is located within the European Union. Encrypted data passes through EU-based servers for synchronization.

**Retention:**
- Encrypted vault data: Retained for the duration of your account
- Deleted items: Permanently removed from servers within 24 hours
- Account deletion: All associated encrypted data removed within 30 days
- Sync logs and hash chains: Retained for 7 days for conflict resolution

---

## 7. Your GDPR Rights

| Right | Article | How to Exercise |
|-------|---------|----------------|
| Access | Art. 15 | Export your vault from within the Application. For account data: contact privacy@zerovault.app |
| Rectification | Art. 16 | Edit directly within the Application |
| Erasure | Art. 17 | Delete items within the Application. For full account deletion: Settings → Delete Account |
| Restriction | Art. 18 | Contact privacy@zerovault.app |
| Data Portability | Art. 20 | Export your vault from within the Application |
| Objection | Art. 21 | Contact privacy@zerovault.app |
| Withdraw Consent | Art. 7(3) | Toggle consent settings within the Application |

**Important:** Under our zero-knowledge architecture, we cannot provide your vault content in response to subject access requests because we do not possess the decryption keys. Use the in-app export functionality to obtain your own data.

We will respond to all requests within 30 days as required by GDPR Art. 12(3).

---

## 8. Data Sharing and Third Parties

**We do NOT:**
- Sell your personal data under any circumstances
- Share your personal data with advertisers, data brokers, or analytics companies
- Share your personal data with third parties for their own marketing purposes
- Provide plaintext access to your vault data to any third party (we CANNOT, not we WILL NOT)

**Processors (all EU-located or EU-compliant):**

| Processor | Purpose | Data Accessed |
|-----------|---------|--------------|
| **Supabase** (EU) | Encrypted sync storage | Ciphertext only |
| **Upstash** (EU) | Rate limiting, cache | Connection metadata only |
| **Sentry** (optional, opt-in) | Crash reporting | Anonymous crash data, no PII |

All processors are contractually bound (Data Processing Agreements under Art. 28) to process data only per our instructions and in compliance with GDPR.

---

## 9. Law Enforcement Requests

Under our zero-knowledge architecture, we CANNOT produce your vault content in response to any law enforcement request, court order, subpoena, or warrant. We do not possess the decryption keys and have no technical capability to decrypt stored ciphertext.

If we receive a legal request for your data, we will:
1. Verify the legal validity of the request
2. Notify you before complying, unless legally prohibited
3. Provide only metadata that we possess (account identifiers, sync timestamps) — never vault content

---

## 10. International Data Transfers

All primary data processing occurs on servers within the European Union. Encrypted ciphertext never leaves EU jurisdiction. Where service providers transfer data outside the EU, we ensure:
- Standard Contractual Clauses (SCCs) approved by the European Commission
- EU-U.S. Data Privacy Framework (DPF) certification where applicable
- Binding Corporate Rules where applicable

---

## 11. Data Breach Notification

In the event of a personal data breach (GDPR Art. 33), we will notify the relevant supervisory authority within 72 hours.

**Due to our zero-knowledge architecture, a server-side data breach would expose ONLY encrypted ciphertext** which is unintelligible without user-controlled decryption keys. No plaintext vault content can be exposed through a server breach. You will be notified if a breach is likely to result in risk to your rights and freedoms (Art. 34).

---

## 12. Security Measures

| Category | Implementation |
|----------|---------------|
| **Encryption** | XChaCha20-Poly1305 (RFC 8439), Argon2id key derivation |
| **Authentication** | PIN-based with biometric unlock (FaceID/TouchID) |
| **Key management** | 256-bit random keys, BIP-39 mnemonic backup, no keys on server |
| **Memory** | SecureBuffer zero-on-dispose, Result<T,E> safe API pattern |
| **Transport** | TLS 1.3, certificate pinning |
| **Sync** | Hash-chain verified sync log, tamper-evident data integrity |
| **Server** | Rate limiting, input validation, dependency scanning, access logging |
| **Development** | Static analysis, code review, dependency audit |

---

## 13. Supervisory Authority

You have the right to lodge a complaint with a supervisory authority. For users in Romania:

**Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP)**  
B-dul G-ral. Gheorghe Magheru 28-30, Sector 1, București  
https://www.dataprotection.ro

---

## 14. Children's Privacy

The Application is not intended for use by children under 16. We do not knowingly collect personal data from children under 16.

---

## 15. Changes to This Policy

Material changes will be notified through the Application at least 30 days in advance. Continued use after changes constitutes acceptance.

---

## 16. Contact

privacy@zerovault.app | Response within 72 hours

---

*This Privacy Policy was drafted in accordance with Regulation (EU) 2016/679 (GDPR), Regulation (EU) 2022/2555 (NIS2), and guidance from the European Data Protection Board (EDPB).*
