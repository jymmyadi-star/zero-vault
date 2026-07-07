import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseForUser, getSupabaseAnon } from '../services/supabase';
import { API_ERRORS } from '../types';
import { Logger } from '../services/logger';

const router = Router();

const seedBodySchema = z.object({
  deviceSalt: z.string().min(1),
  wrappedVaultKey: z.string().min(1),
  wrappedCipherKey: z.string().min(1),
  wrappedSignKey: z.string().min(1),
  pinVerifySalt: z.string().optional(),
  pinVerifyHash: z.string().min(1),
  seedMac: z.string().optional(),
  pairingId: z.string().optional(),
});

router.post('/seed', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }
  if (req.user.isAnonymous) {
    res.status(403).json(API_ERRORS.FORBIDDEN);
    return;
  }

  const body = seedBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, details: body.error.issues });
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const { error } = await supabase.from('vault_seeds').upsert({
      user_id: req.user.id,
      device_salt: body.data.deviceSalt,
      wrapped_vault_key: body.data.wrappedVaultKey,
      wrapped_cipher_key: body.data.wrappedCipherKey,
      wrapped_sign_key: body.data.wrappedSignKey,
      pin_verify_salt: body.data.pinVerifySalt || '',
      pin_verify_hash: body.data.pinVerifyHash,
      seed_mac: body.data.seedMac || '',
      pairing_id: body.data.pairingId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (error) {
      Logger.error(`Vault seed push failed: ${JSON.stringify(error)}`, error, { userId: req.user.id });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    Logger.error('Vault seed push error', err);
    res.status(500).json({ ...API_ERRORS.INTERNAL_ERROR });
  }
});

router.get('/seed', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }
  if (req.user.isAnonymous) {
    res.status(403).json(API_ERRORS.FORBIDDEN);
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const { data, error } = await supabase
      .from('vault_seeds')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      Logger.error('Vault seed pull failed', error, { userId: req.user.id });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    if (!data) {
      res.json(null);
      return;
    }

    res.json({
      deviceSalt: data.device_salt,
      wrappedVaultKey: data.wrapped_vault_key,
      wrappedCipherKey: data.wrapped_cipher_key,
      wrappedSignKey: data.wrapped_sign_key,
      pinVerifyHash: data.pin_verify_hash,
      updatedAt: data.updated_at,
    });
  } catch (err: any) {
    Logger.error('Vault seed pull error', err);
    res.status(500).json({ ...API_ERRORS.INTERNAL_ERROR });
  }
});

// Cross-device pairing: find seed by pairing_id (derived from mnemonic).
// Uses SECURITY DEFINER function that bypasses RLS — any authenticated
// user can retrieve any seed by pairing_id. The seed is PIN-wrapped.
router.get('/seed/pair/:pairingId', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }

  const { pairingId } = req.params;
  if (!pairingId || pairingId.length !== 20) {
    res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, message: 'Invalid pairing ID' });
    return;
  }

  try {
    const supabase = getSupabaseAnon();
    const { data, error } = await supabase.rpc('get_vault_seed_by_pairing', {
      p_pairing_id: pairingId,
    });

    if (error) {
      Logger.error('Pairing seed lookup failed', error, { pairingId });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    if (!data || data.length === 0) {
      res.json(null);
      return;
    }

    const seed = data[0] as any;
    res.json({
      deviceSalt: seed.device_salt,
      wrappedVaultKey: seed.wrapped_vault_key,
      wrappedCipherKey: seed.wrapped_cipher_key,
      wrappedSignKey: seed.wrapped_sign_key,
      pinVerifyHash: seed.pin_verify_hash,
      seedMac: seed.seed_mac,
      updatedAt: seed.updated_at,
    });
  } catch (err: any) {
    Logger.error('Pairing seed lookup error', err);
    res.status(500).json({ ...API_ERRORS.INTERNAL_ERROR });
  }
});

router.delete('/seed', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }
  if (req.user.isAnonymous) {
    res.status(403).json(API_ERRORS.FORBIDDEN);
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const { error } = await supabase
      .from('vault_seeds')
      .delete()
      .eq('user_id', req.user.id);

    if (error) {
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    Logger.error('Vault seed delete error', err);
    res.status(500).json({ ...API_ERRORS.INTERNAL_ERROR });
  }
});

router.head('/seed', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }
  if (req.user.isAnonymous) {
    res.status(403).json(API_ERRORS.FORBIDDEN);
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const { data, error } = await supabase
      .from('vault_seeds')
      .select('user_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error || !data) {
      res.status(404).end();
      return;
    }

    res.status(200).end();
  } catch {
    res.status(500).end();
  }
});

export { router as vaultRouter };
