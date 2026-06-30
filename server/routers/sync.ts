import { Router } from 'express';
import { z } from 'zod';
import { getSupabaseForUser } from '../services/supabase';
import { API_ERRORS } from '../types';
import type { SyncLogRow, SyncOperation } from '../types';
import { Logger } from '../services/logger';
import { config } from '../config';
import { notifySyncAvailable } from '../ws/handlers';

const router = Router();

const syncChangeSchema = z.object({
  entityId: z.string().min(1),
  entityType: z.literal('vaultItem'),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  payloadCiphertext: z.string().min(1),
  newRevision: z.string().nullable().default(null),
  keyEpochId: z.number().int().min(0).default(0),
  hlc: z.string().min(1),
});

const pushBodySchema = z.object({
  changes: z.array(syncChangeSchema).min(1).max(100),
});

const pullQuerySchema = z.object({
  sinceId: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().min(0)),
  pageSize: z.string().optional().transform((v) => v ? Math.min(parseInt(v, 10) || config.SYNC_PAGE_SIZE, config.SYNC_MAX_PAGE_SIZE) : config.SYNC_PAGE_SIZE),
});

router.post('/push', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }

  const body = pushBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, details: body.error.issues });
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);

    // 1. Enforce Hash Chain Linearity
    const { data: lastLog, error: fetchError } = await supabase
      .from('sync_log')
      .select('payload_ciphertext')
      .eq('user_id', req.user.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      Logger.error('Failed to fetch last sync log', fetchError, { userId: req.user.id });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    let currentTipSignature: string | null = null;
    if (lastLog && lastLog.payload_ciphertext) {
      try {
        const parsed = JSON.parse(lastLog.payload_ciphertext);
        currentTipSignature = parsed.chain?.signature || null;
      } catch {
        // Ignored, handled by generic push errors
      }
    }

    let activeTip = currentTipSignature;
    for (const change of body.data.changes) {
      try {
        const parsedIncoming = JSON.parse(change.payloadCiphertext);
        const incomingPrevHash = parsedIncoming.chain?.prev_hash || null;
        const incomingSignature = parsedIncoming.chain?.signature || null;

        if (activeTip !== null && incomingPrevHash !== activeTip) {
          Logger.warn('Hash Chain Fork Detected', { userId: req.user.id, expected: activeTip, got: incomingPrevHash });
          res.status(409).json({ error: 'HASH_CHAIN_CONFLICT', message: 'Client must pull latest changes and rebase.' });
          return;
        }
        
        activeTip = incomingSignature;
      } catch {
        // Parsing error will be caught in the mapping loop below
      }
    }

    const rows: Array<{
      entity_id: string;
      entity_type: string;
      operation: SyncOperation;
      payload_ciphertext: string;
      new_revision: string | null;
      user_id: string;
      key_epoch_id: number;
      hlc: string;
    }> = [];

    for (const change of body.data.changes) {
      if (change.payloadCiphertext.length > 500_000) {
        res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, message: 'Payload too large' });
        return;
      }
      try {
        JSON.parse(change.payloadCiphertext);
      } catch {
        res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, message: 'Invalid payload format' });
        return;
      }

      rows.push({
        entity_id: change.entityId,
        entity_type: change.entityType,
        operation: change.operation,
        payload_ciphertext: change.payloadCiphertext,
        new_revision: change.newRevision,
        user_id: req.user.id,
        key_epoch_id: change.keyEpochId,
        hlc: change.hlc,
      });
    }

    const { error } = await supabase.from('sync_log').insert(rows);

    if (error) {
      Logger.error('Sync push failed', error, { userId: req.user.id, changeCount: rows.length });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    setTimeout(() => {
      notifySyncAvailable(req.user!.id, rows.length).catch(() => {});
    }, 0);

    Logger.info('Sync push accepted', { userId: req.user.id, accepted: rows.length });
    res.json({ accepted: rows.length, rejected: 0 });
  } catch (err: any) {
    Logger.error('Sync push error', err);
      res.status(500).json(API_ERRORS.INTERNAL_ERROR);
  }
});

router.get('/pull', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }

  const query = pullQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, details: query.error.issues });
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const pageSize = query.data.pageSize;

    const { data: logs, error } = await supabase
      .from('sync_log')
      .select('*')
      .gt('id', query.data.sinceId)
      .eq('user_id', req.user.id)
      .order('id', { ascending: true })
      .limit(pageSize + 1);

    if (error) {
      Logger.error('Sync pull failed', error, { userId: req.user.id });
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    const hasMore = logs.length > pageSize;
    const resultLogs = hasMore ? logs.slice(0, pageSize) : logs;

    const mapped: SyncLogRow[] = resultLogs.map((log) => ({
      id: log.id,
      entity_id: log.entity_id,
      entity_type: log.entity_type,
      operation: log.operation,
      payload_ciphertext: log.payload_ciphertext,
      new_revision: log.new_revision,
      user_id: log.user_id,
      key_epoch_id: log.key_epoch_id,
      hlc: log.hlc,
      created_at: log.created_at,
    }));

    const lastId = mapped.length > 0 ? mapped[mapped.length - 1]!.id : query.data.sinceId;

    res.json({ logs: mapped, hasMore, lastId });
  } catch (err: any) {
    Logger.error('Sync pull error', err);
      res.status(500).json(API_ERRORS.INTERNAL_ERROR);
  }
});

router.get('/status', async (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }

  try {
    const supabase = getSupabaseForUser(req.userToken!);
    const { data, error } = await supabase
      .from('sync_log')
      .select('id')
      .eq('user_id', req.user.id)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(502).json(API_ERRORS.SUPABASE_ERROR);
      return;
    }

    res.json({ lastId: data?.id || 0 });
  } catch (err: any) {
    Logger.error('Sync status error', err);
      res.status(500).json(API_ERRORS.INTERNAL_ERROR);
  }
});

export { router as syncRouter };
