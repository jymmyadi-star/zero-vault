import { supabase, isSupabaseConfigured } from '../supabase';
import { exportVaultSeed, importVaultSeed, type VaultSeed, type VaultKeySet } from '../crypto/vault-keychain';
import { startSyncScheduler, stopSyncScheduler } from '../sync/sync-scheduler';
import { isSyncEnabled, enableSync } from '../sync/index';
import { apiClient } from './api-client';
import { useVaultStore } from '../store/vault-store';
import { Logger } from '../logger';

export async function isIdentityLinked(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return !!(user && user.email && !user.email.endsWith('@anonymous.local'));
  } catch {
    return false;
  }
}

export async function upgradeToIdentity(
  email: string,
  password: string,
): Promise<{ success: boolean; needsVerification: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('No active session. Enable cloud sync first.');
  }

  if (user.email && !user.email.endsWith('@anonymous.local')) {
    return { success: true, needsVerification: false };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    email,
    password,
  });

  if (updateError) {
    Logger.error('[Identity] Failed to upgrade anonymous account', updateError, { module: 'Identity' });
    throw new Error(updateError.message);
  }

  await pushVaultSeed();

  Logger.info('[Identity] Account upgraded — pending email verification', {
    module: 'Identity',
    emailHash: email.substring(0, 3) + '***@' + email.split('@')[1],
  });

  return { success: true, needsVerification: true };
}

export async function joinExistingVault(
  email: string,
  password: string,
  pin: string,
): Promise<VaultKeySet> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user) {
    throw new Error(signInError?.message || 'Login failed. Check your email and password.');
  }

  const seedData = await apiClient.pullVaultSeed();

  if (!seedData) {
    throw new Error('No vault seed found for this account. Ask the vault owner to enable Cross-Device Sync.');
  }

  const seed: VaultSeed = {
    deviceSalt: seedData.deviceSalt,
    wrappedVaultKey: seedData.wrappedVaultKey,
    wrappedCipherKey: seedData.wrappedCipherKey,
    wrappedSignKey: seedData.wrappedSignKey,
    pinVerifySalt: (seedData as any).pinVerifySalt || '',
    pinVerifyHash: seedData.pinVerifyHash,
  };

  const keySet = await importVaultSeed(pin, seed);

  if (isSyncEnabled()) {
    startSyncScheduler();
  } else {
    await enableSync();
  }

  Logger.info('[Identity] Joined existing vault', {
    module: 'Identity',
    userId: signInData.user.id,
  });

  return keySet;
}

export async function pushVaultSeed(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const signKey = useVaultStore.getState().signKey?.copy();
    const seed = await exportVaultSeed(signKey ?? undefined);
    if (signKey) { signKey.fill(0); }
    await apiClient.pushVaultSeed({
      deviceSalt: seed.deviceSalt,
      wrappedVaultKey: seed.wrappedVaultKey,
      wrappedCipherKey: seed.wrappedCipherKey,
      wrappedSignKey: seed.wrappedSignKey,
      pinVerifySalt: seed.pinVerifySalt,
      pinVerifyHash: seed.pinVerifyHash,
      seedMac: seed.seedMac,
      pairingId: seed.pairingId,
    });
    Logger.info('[Identity] Vault seed pushed', { module: 'Identity' });
  } catch (err: any) {
    Logger.warn('[Identity] Failed to push vault seed', {
      module: 'Identity',
      error: err.message,
    });
  }
}

export async function resendVerificationEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw new Error(error.message);
}
