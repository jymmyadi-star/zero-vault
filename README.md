# 🛡️ Socler
**The Sovereign Password Manager.**

![Socler Banner](https://via.placeholder.com/1200x400/08080C/FFFFFF?text=SOCLER+-+Self-Custodial+Security)

**Socler** is a next-generation, zero-knowledge password manager and security enclave. It features an avant-garde "Spatial Liquid Glass" aesthetic and military-grade cryptography designed to protect your most sensitive digital credentials. Available as a React Native mobile application and a Chrome Browser Extension.

## ✨ Features
*   **Zero-Knowledge Architecture:** Your Master Password/PIN never leaves the device. All data is encrypted locally using `XChaCha20-Poly1305` before syncing.
*   **GPU-Resistant KDF:** Master keys are derived using `Argon2id` (128 MB / 6 passes) via native bindings, offering state-of-the-art memory-hard protection against brute-force and ASIC attacks.
*   **Offline-First & Local Persistence:** Lightning-fast offline access via expo-sqlite + Drizzle ORM (Mobile) with lazy-loading capabilities.
*   **Sovereign Sync:** Hybrid Logical Clocks (HLC), background polling, and a serialized sync backlog handle conflict-free, concurrent synchronization across all your devices without data loss.
*   **Avant-Garde UI:** "Spatial Liquid Glass" design language featuring deep ambient lighting, micro-animations, and fluid transitions.
*   **Auto-Lock & Memory Purge:** Advanced lifecycle tracking ensures plaintext memory is zeroed out (`SecureBuffer.dispose()`) and the vault is locked when the app goes to the background.
*   **Browser Extension:** Native autofill capabilities strictly guarded against phishing by validating DNS boundaries.
*   **Data Portability:** Seamlessly import and export your vault to/from Bitwarden, 1Password, Chrome, or generic CSVs.

## 🔐 Cryptographic Implementation
Socler takes no shortcuts when it comes to cryptography:
1.  **Key Derivation:** The user's Master PIN/Password is stretched using `Argon2id` alongside a securely generated Device Salt (stored in the hardware enclave).
2.  **Key Wrapping:** Memory-safe `SecureBuffer` instances wrap the VaultKey, CipherKey, and SignKey. The memory is immediately overwritten with `0` when disposed to prevent RAM scraping.
3.  **Data Encryption:** Vault payloads are serialized to JSON and encrypted using `XChaCha20-Poly1305`.
4.  **Integrity Validation:** Sync logs implement cryptographic hash chains (`verifyHashChain`) to prevent server rollback or tampering attacks.

## 🚀 Getting Started (Development)

### Prerequisites
*   Node.js (v18+)
*   npm or pnpm
*   Expo CLI

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/socler.git
   cd socler
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (Mobile):
   ```bash
   npm run dev
   ```

### Running the Browser Extension
1. Build the extension:
   ```bash
   cd browser-extension
   npm run build
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `browser-extension/dist` folder.

### Connecting to Cloud Sync (Optional)
If you wish to use the synchronization engine, you must configure a Supabase instance:
1. Copy `.env.example` to `.env`.
2. Add your `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Set up the Supabase backend: deploy the Edge Functions (`auth-signin`, `sync-push`, `sync-pull`, `vault-seed`) and create the required tables with RLS policies. The endpoint mapping lives in `lib/sync/api-client.ts`.

## 📦 Production Build (Android)
Socler uses Expo Application Services (EAS) for seamless cloud builds.
To generate an Android App Bundle (`.aab`) for the Google Play Store:
```bash
eas build -p android --profile production
```

## 📄 License & Liability
Socler is open-source under the **MIT License**.
**Zero Liability / As-Is:** This application is provided without warranty. The developer has zero access to your master password or encryption keys. The developer is not liable for any data loss, compromised accounts, or loss of funds. You are solely responsible for maintaining backups of your Vault and remembering your Master PIN.

---
*Built with React Native, Expo, expo-sqlite (Drizzle ORM), and Supabase.*
