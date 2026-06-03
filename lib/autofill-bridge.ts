import { NativeModules } from 'react-native';

const { VaultAutofillBridge } = NativeModules;

/**
 * Enables Android Autofill by storing the database key in shared storage
 * so the native AutofillService can access it.
 * Must be called when vault is unlocked and database is initialized.
 */
export function enableAutofillBridge(dbKeyHex: string): void {
  if (VaultAutofillBridge) {
    VaultAutofillBridge.setDbKey(dbKeyHex);
  }
}

/**
 * Clears the stored key when vault is locked.
 */
export function disableAutofillBridge(): void {
  if (VaultAutofillBridge) {
    VaultAutofillBridge.clearDbKey();
  }
}
