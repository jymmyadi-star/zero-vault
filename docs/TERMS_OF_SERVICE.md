# Terms of Service — Zero Vault

**Last Updated:** May 2026 | **Version:** 1.0  
**Governing Law:** Romania / European Union

---

## 1. Acceptance of Terms

By accessing or using Zero Vault ("the Application", "the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Application.

---

## 2. Service Description

Zero Vault is a **zero-knowledge encrypted credential manager and digital vault**. Its sole intended purpose is to allow you to securely store, organize, and access your passwords, seed phrases, and secure notes using client-side encryption.

**The Application is NOT:**
- A backup service, cloud storage provider, or data recovery service
- A financial institution, payment processor, or cryptocurrency wallet
- An identity verification service or authentication authority
- A medical device, healthcare provider, or diagnostic tool

**The Application does NOT:**
- Have access to, store, or possess your encryption keys or recovery phrase
- Have the ability to decrypt, read, or recover your stored content
- Guarantee the security of your device, operating system, or network connection
- Guarantee third-party website compatibility or autofill functionality on all websites

---

## 3. Zero-Knowledge Architecture — CRITICAL

Zero Vault employs **client-side encryption** using XChaCha20-Poly1305 with keys derived via Argon2id from your PIN.

**YOU ACKNOWLEDGE AND AGREE THAT:**

1. All content you store is encrypted on your device BEFORE it leaves your phone. We never receive, possess, or store your encryption keys, PIN, or recovery phrase in any plaintext form.

2. Your recovery phrase (BIP-39 mnemonic) is the SOLE means of recovering your data if you lose access to your device or forget your PIN. We cannot recover your data for you. **We do not have the technical ability to do so.**

3. **IF YOU LOSE YOUR RECOVERY PHRASE AND DEVICE, YOUR DATA IS PERMANENTLY AND IRRETRIEVABLY LOST.** This is an intentional architectural property of the zero-knowledge design, not a defect.

4. Encrypted ciphertext stored on our synchronization servers is unintelligible to us and to any third party without your decryption keys.

**YOU BEAR SOLE RESPONSIBILITY FOR SAFEGUARDING YOUR RECOVERY PHRASE AND PIN. WRITE DOWN YOUR RECOVERY PHRASE AND STORE IT IN A PHYSICALLY SECURE LOCATION.**

---

## 4. Your Responsibilities

As the user, you are the **data controller** of all content you store in the Application.

You agree that:
- You will safeguard your recovery phrase, PIN, and device passcode
- You will not share your recovery phrase with anyone, including persons claiming to represent Zero Vault or its developers
- You will not use the Application for any unlawful purpose, including storing credentials for unauthorized access to systems or accounts you do not own
- You will not store content that infringes on the intellectual property rights of others
- You are solely responsible for the accuracy and legality of the content you store
- You are responsible for maintaining the security of the devices on which the Application is installed
- You will regularly export and back up your vault data using the export functionality provided in the Application

---

## 5. Third-Party Services and Cryptocurrency

The Application may allow you to store seed phrases and private keys for cryptocurrency wallets. You acknowledge that:

- Zero Vault is NOT a cryptocurrency wallet, exchange, or financial service
- We do NOT have access to your seed phrases or private keys
- We are NOT responsible for any loss of cryptocurrency or digital assets resulting from lost recovery phrases, device failure, phishing attacks, malware, or any other cause
- Storing cryptocurrency seed phrases or private keys is at your SOLE RISK
- You should always maintain separate, offline backups of any cryptocurrency seed phrases

---

## 6. Browser Extension and Autofill

The Chrome browser extension is provided "AS IS". You acknowledge that:
- Autofill functionality depends on third-party website structures which may change without notice
- The autofill content script runs with the permissions you grant it at installation
- We are not responsible for autofill failures, incorrect field detection, or website incompatibilities
- You should always verify that credentials are filled into the correct website before submitting

---

## 7. Intellectual Property

The Application, its codebase, design, user interface, documentation, and related materials ("Zero Vault IP") are the exclusive property of the developer. All rights reserved.

User-generated content stored within the Application remains the property of the user, subject to the encryption described in Section 3. We claim no ownership of your stored content.

---

## 8. Disclaimer of Warranties

**THE APPLICATION AND ALL RELATED SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:**

- WARRANTIES OF MERCHANTABILITY
- WARRANTIES OF FITNESS FOR A PARTICULAR PURPOSE
- WARRANTIES OF ACCURACY, RELIABILITY, SECURITY, OR COMPLETENESS OF STORED DATA
- WARRANTIES OF UNINTERRUPTED OR ERROR-FREE OPERATION
- WARRANTIES OF COMPATIBILITY WITH ANY THIRD-PARTY WEBSITE, APPLICATION, OR SERVICE
- WARRANTIES REGARDING THE SECURITY OF ENCRYPTION ALGORITHMS AGAINST FUTURE CRYPTANALYTIC ADVANCES
- WARRANTIES THAT YOUR DATA WILL NOT BE LOST, CORRUPTED, OR RENDERED INACCESSIBLE

**YOUR USE OF THE APPLICATION IS AT YOUR SOLE RISK. WE DO NOT WARRANT THAT STORED DATA WILL BE ACCURATE, RETAINED PERMANENTLY, OR REMAIN ACCESSIBLE UNDER ALL CIRCUMSTANCES.**

---

## 9. Limitation of Liability

**TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:**

1. **We shall NOT be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages**, including but not limited to damages for loss of profits, goodwill, use, data, cryptocurrency, digital assets, or other intangible losses, arising from or relating to your use of the Application.

2. **We shall NOT be liable for damages resulting from:**
   - Loss of data due to lost, forgotten, or compromised recovery phrases or PINs
   - Unauthorized access to your device or the Application
   - Phishing attacks, malware, keyloggers, or other security compromises of your device
   - Failure of encryption algorithms due to advances in cryptanalysis or quantum computing
   - Reliance on stored credentials for financial, medical, legal, or other critical decisions
   - Interruption, suspension, or discontinuation of the Application or synchronization services
   - Incompatibility with websites, applications, autofill targets, or third-party services
   - Any security vulnerability in the operating system, browser, or hardware on which the Application runs

3. **Monetary Cap:** In any event, our total liability for any claim arising from your use of the Application shall not exceed the greater of: (a) the amount you paid us (if any) during the twelve (12) months preceding the claim, or (b) one hundred euros (€100).

4. **Time Limit:** Any claim related to your use of the Application must be filed within one (1) year of the date the cause of action arose.

---

## 10. Indemnification

You agree to indemnify, defend, and hold harmless the developer from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable legal fees) arising from:
- Your use of the Application
- Your violation of these Terms
- Your violation of any third-party rights, including intellectual property rights
- Your storage of content that is unlawful or infringes upon third-party rights
- Your loss of cryptocurrency, digital assets, or financial value resulting from any cause

---

## 11. No Recovery Guarantee — Informed Consent

By using the Application, you explicitly acknowledge and consent to the following:

> "I understand that Zero Vault uses zero-knowledge encryption. The developer cannot recover my data under any circumstances, including by court order, law enforcement request, or my own request. My recovery phrase is the only way to restore access to my data. If I lose my recovery phrase, my data is permanently lost."

This acknowledgment is a material condition of your use of the Application.

---

## 12. Cryptography and Export Control

The Application contains cryptographic functionality that may be subject to export controls under:
- Council Regulation (EU) 2021/821 (EU Dual-Use Regulation)
- The Wassenaar Arrangement on Export Controls for Conventional Arms and Dual-Use Goods and Technologies

The Application qualifies as "publicly available" software under Category 5, Part 2 of Annex I of Regulation 2021/821 (cryptography note), and is therefore exempt from export authorization requirements when distributed through publicly accessible app stores.

---

## 13. Regulatory Status

Zero Vault is NOT a medical device within the meaning of Regulation (EU) 2017/745 (MDR). It is a cryptocurrency wallet as defined by Regulation (EU) 2023/1114 (MiCA) only insofar as it stores private cryptographic keys on behalf of clients. It does not provide exchange services, custody services, or financial advice.

Zero Vault falls within the scope of Regulation (EU) 2022/2555 (NIS2) only if classified as a provider of managed security services, which the developer does not concede given the zero-knowledge architecture where all security operations occur client-side.

---

## 14. Governing Law and Disputes

These Terms shall be governed by and construed in accordance with the laws of Romania and the European Union. Any disputes arising from or relating to these Terms shall be subject to the exclusive jurisdiction of the competent courts of Bucharest, Romania.

For consumers in the European Union, you may also benefit from mandatory consumer protection provisions of the law of your country of residence. This does not affect your statutory rights as a consumer.

---

## 15. Changes to These Terms

We reserve the right to modify these Terms at any time. Material changes will be notified through the Application at least thirty (30) days before they become effective. Continued use of the Application after changes become effective constitutes acceptance of the modified Terms. If you do not agree to the modified Terms, you must cease using the Application and export your data.

---

## 16. Termination

We reserve the right to terminate or suspend your access to the Application for violation of these Terms. Upon termination, you may export your encrypted data using the export functionality provided in the Application.

---

## 17. Contact

For legal inquiries: **legal@zerovault.app**

---

*These Terms were drafted in accordance with Regulation (EU) 2016/679 (GDPR), Regulation (EU) 2022/2555 (NIS2), Regulation (EU) 2021/821 (Dual-Use), and Romanian Law 287/2009 (Civil Code).*
