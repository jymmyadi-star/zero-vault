# ZERO VAULT — CEO Verification Report

**Audited by:** Automated Security & Architecture Review  
**Date:** 2026-05-30  
**Project:** Zero Vault — Zero-Knowledge Password Manager  
**Verdict:** 有条件通过 (Conditional Pass) — 7.5/10

---

## Executive Summary

This is a real product. Not a demo, not a tutorial, not a hackathon project. Someone understood cryptography and shipped it. The zero-knowledge architecture is correctly implemented. Argon2id, XChaCha20-Poly1305, HKDF, HMAC — every primitive is modern and used in the right place. GDPR compliance documentation is better than 90% of funded startups.

Three problems prevent production readiness. Fix them and you have a product. Don't fix them and you're a very impressive resume project.

---

## Scorecard

| Category | Score | Comment |
|---|---|---|
| Crypto Design | 9/10 | Near-perfect. One gap. |
| Zero-Knowledge Guarantee | 10/10 | Server is truly blind. Verified. |
| Offline-First | 10/10 | Full functionality without server. |
| Sync Integrity | 9/10 | Hash chain is tamper-evident. One gap. |
| Data Protection (GDPR) | 10/10 | ROPA, DPIA, consent manager, breach protocol. |
| Test Coverage | 7/10 | Good unit tests. No E2E. No fuzz. |
| Supply Chain | 5/10 | 46 deps. Too many. |
| Production Readiness | 6/10 | Three gaps block deployment. |
| Code Maintainability | 7/10 | Clean but 3 codebases. |
| **OVERALL** | **7.5/10** | Conditional pass. |

---

## Critical Issues — Status After Review (2026-06-03)

### 1. Synchronization Silent Failure Bug
**Status: ✅ ALREADY FIXED**

The `drainBacklog` function stores `plaintextPayload` in the backlog entry (see `enqueueToBacklog`, line ~143)
and re-encrypts from plaintext on every retry attempt (see `drainBacklog`, lines ~211-214).
The DEK disposal concern from the original audit is no longer applicable.
The fix was in place before this review.

---

### 2. In-Memory Rate Limiter — Multi-Instance Death
**Status: ✅ FIXED (2026-06-03)**

`RedisStore` class was already implemented in `server/middleware/rate-limiter.ts`.
The problem was that Redis was declared as an **optional profile** in `docker-compose.yml`
(requiring `--profile redis` to activate) and `REDIS_URL` was missing from `.env.example`.

**Fixes applied:**
- `docker-compose.yml`: Redis service is now a first-class dependency (removed `profiles`, added `depends_on` + auto-inject `REDIS_URL=redis://redis:6379` to API service)
- `.env.example`: Added `REDIS_URL=redis://localhost:6379` with documentation

**Result:** `docker compose up` now starts Redis automatically alongside the API.
The `initRateLimitStore()` call in `server/index.ts` will detect `REDIS_URL` and activate `RedisStore`.

---

### 3. Server WebSocket: No Authentication on Connection
**Status: ✅ ALREADY FIXED**

The `upgrade` handler in `server/ws/index.ts` validates the JWT token at the HTTP upgrade phase,
**before** calling `wss.handleUpgrade`. Unauthorized connections are rejected with `401` and the
socket is destroyed without ever entering the WebSocket state. The fix was in place before this review.

---


## High Priority — Fix Within 2 Weeks

### 4. Browser Extension Crypto Duplication

**Files:** browser-extension/lib/crypto.ts vs lib/crypto/crypto-utils.ts

The extension has a standalone copy of XChaCha20, HKDF, and HMAC logic (145 lines). This means bug fixes must be applied in 2 places, the extension's crypto has no unit tests, and if someone fixes a vulnerability in one, the other stays vulnerable.

**Impact:** Maintenance debt. Potential security divergence.

**Fix:** Extract crypto primitives into a shared package consumed by both mobile and extension.

**Estimate:** 1 day.

### 5. Password Generator Lacks Character Set Validation

**File:** lib/password-generator.ts

The generatePassword function accepts user-provided character sets. If a user passes an empty string or a set with no usable characters, the function enters an infinite loop or returns garbage. No validation on includeUppercase, includeNumbers, etc.

**Impact:** Deterministic infinite loop if called with bad params. App freeze.

**Fix:** Add validation: at least one character class must be selected, combined character set must have length > 0.

**Estimate:** 30 minutes.

### 6. Sync Backlog Has No Size Limit

**File:** lib/db/schema.ts -> sync_backlog table

Failed sync entries accumulate indefinitely. No retention policy, no cleanup, no ceiling. If a user's phone is offline for 6 months with heavy usage, the sync_backlog grows unbounded.

**Impact:** Storage bloat. Slow startup. Potential WatermelonDB performance degradation.

**Fix:** Add maxBacklogSize check. When exceeded, compact: merge sequential entries for the same record_id, or expire entries older than 30 days.

**Estimate:** 3 hours.

---

## Medium Priority — Fix Within 1 Month

### 7. No E2E Tests

106+ unit tests is good. But zero tests for: vault creation -> add password -> sync to server -> pull from server on second device -> decrypt -> verify match. The most important user flow has no automated coverage.

**Fix:** Add 3 E2E tests: vault create -> item CRUD -> sync roundtrip. Use supertest for the API (already installed) and mock the WatermelonDB layer.

**Estimate:** 1 day.

### 8. 46 Production Dependencies — Supply Chain Risk

Every dependency is a potential backdoor. expo-linear-gradient and expo-blur for visual polish — are these worth the risk in a security product? phosphor-react-native icons could be vendored. clsx + tailwind-merge could be implemented in 50 lines.

**Fix:** Audit npm audit monthly (already in CI). Consider vendoring small dependencies. Add --audit-level=moderate to CI (currently high only).

### 9. No Key Rotation Mechanism

If a user's SignKey or CipherKey is compromised (unlikely, but possible via side-channel), there is no mechanism to rotate keys and re-encrypt the vault. All sync log entries are sealed with one key epoch.

**Fix:** Add key_epoch_id increment on rotation (column already exists in schema). Implement rotateKeys() that re-wraps all keys with a new master.

**Estimate:** 2 days.

### 10. No Fuzz Testing on Crypto

Crypto primitives are tested with happy-path vectors. No malformed input testing (truncated ciphertext, wrong nonce length, invalid base64).

**Fix:** Add 20+ fuzz test cases: wrong key lengths, tampered ciphertext, bit-flipped nonces, empty buffers, Unicode edge cases in PINs.

**Estimate:** 4 hours.

---

## Low Priority — Nice to Have

11. **Auto-Lock Timeout Is Hardcoded** — lib/hooks/useAutoLock.ts: const LOCK_TIMEOUT_MS = 5 * 60 * 1000. No user setting. Power users want 1 minute or 15 minutes.

12. **No Export Format Standardization** — Export is JSON but doesn't follow any standard (Bitwarden CSV, 1Password 1pux, KeePass XML). Users can only import their own exports.

13. **PIN Is Numeric-Only** — 8+ digit PIN. No alphanumeric passphrase option. Deliberate design choice (Argon2id hardening), but some users will demand it.

---

## What's Actually Great

1. **Zero-knowledge architecture is real.** The server stores only XChaCha20 ciphertext. Keys never leave the device. Even if the server is fully compromised, attacker gets gibberish.

2. **SecureBuffer** — Auto-zeroing memory for key material. 90% of password managers don't do this. It's the difference between encrypted and secure.

3. **Result<T,E>** — Rust-style error handling in TypeScript. Every crypto operation returns Ok | Err. No uncaught exceptions in the security-critical path.

4. **GDPR documentation** is production-grade. ROPA, DPIA, consent manager, breach protocol. Submit this to an EU data protection authority today.

5. **CI/CD with security scanning** — SAST via Semgrep, dependency audit, crypto-specific test runner. Most startups ship without any of this.

6. **Audit engine** — A self-auditing tool that scans your own codebase for crypto weaknesses, hardcoded secrets, and compliance gaps.

---

## Summary

```
Strengths:  Crypto correctness, zero-knowledge guarantee, GDPR compliance, SecureBuffer, CI/CD
Gaps:       Sync DEK disposal bug, rate limiter scaling, WebSocket auth, no E2E tests, 46 deps
```

The crypto is right. The architecture is right. The sync has a data-loss bug. The production deployment has scaling holes.

**Bottom line:** Fix 3 critical bugs, add E2E tests, and you can charge money. The zero-knowledge guarantee is real. That's the only thing users pay for — everything else is just engineering.
