# Zero Vault — Comprehensive Security & Functional Audit Prompt

**Role:** Senior Security Auditor & Code Reviewer
**Context:** Zero Vault is a zero-knowledge password manager with a React Native mobile app, Node.js sync server, and Chrome browser extension. The app uses Argon2id + XChaCha20-Poly1305 + HMAC-SHA256 for encryption, and Supabase for sync with RLS enforcement.

**Your Task:** Perform a comprehensive codebase audit. Read every file listed below line-by-line, identify any issues, and produce a structured report.

---

## AUDIT RULES

1. **Read every file completely.** Do not skim. Do not rely on file names alone.
2. **For every issue found**, provide: file path, line number, severity (CRITICAL/HIGH/MEDIUM/LOW), category, and a 1-2 sentence explanation.
3. **Do NOT propose code changes.** Only identify issues. I will fix them.
4. **Prioritize REAL problems.** Skip trivial style/formatting issues unless they cause a bug.

---

## CATEGORIES TO CHECK

| Category | What to look for |
|----------|-----------------|
| **Secrets** | Hardcoded API keys, JWT tokens, passwords, private keys, Supabase service keys, `.env` files with real values |
| **Crypto misuse** | Math.random() for crypto, ECB mode, MD5, weak RNG, IV reuse, non-constant-time comparison, missing AAD |
| **Memory safety** | Keys not zeroed after use, plaintext left in Uint8Array buffers, SecureBuffer.dispose() not called in finally blocks, missing .fill(0) on derived keys |
| **Auth bypass** | Missing auth middleware, token validation skipped, RLS policies that allow unintended access, anonymous users accessing restricted endpoints |
| **Injection** | SQL injection, eval(), unsanitized input in queries, path traversal |
| **Race conditions** | Async operations without proper ordering, parallel SecureStore writes without dependency handling, try/finally blocks that skip cleanup on error paths |
| **Transaction atomicity** | DB writes without transactions, partial state on failure, missing rollback |
| **Rate limiting** | Missing rate limits on auth endpoints, WebSocket upgrade flooding, brute-force protection gaps |
| **Error handling** | Swallowed errors (empty catch blocks), try/catch that silently returns null, error messages leaking sensitive information |
| **Logic bugs** | Dead code, unreachable branches, conditions that are always true/false, variables used before assignment, incorrect type coercion |
| **TypeScript** | any type abuse, missing null checks, incorrect generic usage, type assertions that hide errors |
| **Import issues** | Circular dependencies, missing exports, incorrect relative paths, import of Node.js modules in React Native code |
| **Network** | HTTP (not HTTPS) URLs in production code, missing TLS validation, hardcoded localhost URLs |
| **Extension-specific** | Manifest V3 compliance, CSP violations, service worker wake-up handling, IndexedDB errors, chrome.storage usage |
| **Null safety** | Operations on potentially null/undefined values, .find() without result check, array access without bounds check |
| **Concurrency** | setInterval without cleanup, event listeners not removed, memory leaks from unsubscribed observers |

---

## FILES TO AUDIT (read every one completely)

### CRITICAL — Crypto Core
- `lib/crypto/shared-primitives.ts`
- `lib/crypto/crypto-utils.ts`
- `lib/crypto/secure-buffer.ts`
- `lib/crypto/vault-keychain.ts`
- `lib/crypto/bip39.ts`
- `lib/crypto/totp.ts`

### CRITICAL — Sync Engine
- `lib/sync/push.ts`
- `lib/sync/pull.ts`
- `lib/sync/api-client.ts`
- `lib/sync/hash-chain.ts`
- `lib/sync/verified-hash.ts`
- `lib/sync/identity.ts`

### CRITICAL — Server
- `server/app.ts`
- `server/index.ts`
- `server/config.ts`
- `server/routers/auth.ts`
- `server/routers/sync.ts`
- `server/routers/vault.ts`
- `server/middleware/auth.ts`
- `server/middleware/rate-limiter.ts`
- `server/services/supabase.ts`
- `server/ws/index.ts`
- `server/ws/handlers.ts`
- `server/types.ts`

### HIGH — Data Layer
- `lib/db/schema.ts`
- `lib/db/index.ts`
- `lib/db/migrations.ts`
- `lib/store/vault-store.ts`
- `lib/storage.ts`

### HIGH — Business Logic
- `lib/key-rotation.ts`
- `lib/password-generator.ts`
- `lib/vault-export.ts`
- `lib/services/vault-service.ts`
- `lib/consent-manager.ts`

### HIGH — UI Hooks & Auth
- `hooks/useVaultAuth.ts`
- `lib/hooks/useAutoLock.ts`
- `lib/autofill-bridge.ts`

### HIGH — Browser Extension
- `browser-extension/manifest.json`
- `browser-extension/background/service-worker.ts`
- `browser-extension/lib/crypto.ts`
- `browser-extension/lib/api.ts`
- `browser-extension/lib/storage.ts`
- `browser-extension/lib/types.ts`
- `browser-extension/popup/popup.ts`
- `browser-extension/content/autofill.ts`
- `browser-extension/build.mjs`

### MEDIUM — Config & Migrations
- `.env.example`
- `.env.production.example`
- `supabase/migrations/001_vault_foundation.sql`
- `supabase/migrations/002_vault_seeds.sql`
- `supabase/migrations/003_pairing_id.sql`
- `kilo.json`

---

## OUTPUT FORMAT

Return a structured report in this exact format:

```
=== AUDIT REPORT: ZERO VAULT ===
Total files audited: <count>
Total issues found: <count>
By severity: CRITICAL=<n> HIGH=<n> MEDIUM=<n> LOW=<n>

--- CRITICAL ISSUES ---
[FILE:LINE] <category> — <one-line description>
[FILE:LINE] <category> — <one-line description>

--- HIGH ISSUES ---
[FILE:LINE] <category> — <one-line description>

--- MEDIUM ISSUES ---
[FILE:LINE] <category> — <one-line description>

--- LOW ISSUES ---
[FILE:LINE] <category> — <one-line description>

--- SUMMARY ---
<2-3 sentence overall assessment of the codebase>
```

**IMPORTANT:** Do NOT skip any file. Read every line. Be thorough. If you find 0 issues in a file, note it in the summary but do not fabricate problems.
