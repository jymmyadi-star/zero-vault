# 🛡️ Zero Vault
**The Sovereign Password Manager.**

![Zero Vault Banner](https://via.placeholder.com/1200x400/08080C/FFFFFF?text=ZERO+VAULT+-+Self-Custodial+Security)

**Zero Vault** is a next-generation, zero-knowledge password manager and security enclave. It features an avant-garde "Spatial Liquid Glass" aesthetic and military-grade cryptography designed to protect your most sensitive digital credentials. Available as a React Native mobile application and a Chrome Browser Extension.

## ✨ Features
*   **Zero-Knowledge Architecture:** Your Master Password/PIN never leaves the device. All data is encrypted locally using `XChaCha20-Poly1305` before syncing.
*   **GPU-Resistant KDF:** Master keys are derived using `PBKDF2-HMAC-SHA512` (150,000 iterations) via native bindings, offering state-of-the-art protection against brute-force and ASIC attacks.
*   **Offline-First & Local Persistence:** Lightning-fast offline access via WatermelonDB (Mobile) with lazy-loading capabilities.
*   **Real-Time Sovereign Sync:** Hybrid Logical Clocks (HLC), WebSockets, and a Mutex Queue Engine handle conflict-free, concurrent synchronization across all your devices without data loss.
*   **Avant-Garde UI:** "Spatial Liquid Glass" design language featuring deep ambient lighting, micro-animations, and fluid transitions.
*   **Auto-Lock & Memory Purge:** Advanced lifecycle tracking ensures plaintext memory is zeroed out (`SecureBuffer.dispose()`) and the vault is locked when the app goes to the background. Also features OS-level screenshot prevention in the App Switcher.
*   **Browser Extension:** Native autofill capabilities strictly guarded against phishing by validating DNS boundaries.
*   **Data Portability:** Seamlessly import and export your vault to/from Bitwarden, 1Password, Chrome, or generic CSVs.

## 🔐 Cryptographic Implementation
Zero Vault takes no shortcuts when it comes to cryptography:
1.  **Key Derivation:** The user's Master PIN/Password is stretched using `PBKDF2-HMAC-SHA512` alongside a securely generated Device Salt (stored in the hardware enclave).
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
   git clone https://github.com/yourusername/zero-vault.git
   cd zero-vault
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
3. Apply the database migrations found in the `/supabase` folder to your instance.

## 📦 Production Build (Android)
Zero Vault uses Expo Application Services (EAS) for seamless cloud builds.
To generate an Android App Bundle (`.aab`) for the Google Play Store:
```bash
eas build -p android --profile production
```

## 📄 License & Liability
Zero Vault is open-source under the **MIT License**.
**Zero Liability / As-Is:** This application is provided without warranty. The developer has zero access to your master password or encryption keys. The developer is not liable for any data loss, compromised accounts, or loss of funds. You are solely responsible for maintaining backups of your Vault and remembering your Master PIN.

---
*Built with React Native, Expo, WatermelonDB, and Supabase.*
