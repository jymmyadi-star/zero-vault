import type { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../services/supabase';
import { Logger } from '../services/logger';
import type { AuthenticatedUser } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userToken?: string;
      requestId?: string;
    }
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function validateTokenClaims(token: string): { valid: boolean; reason?: string } {
  const payload = decodeJwtPayload(token);
  if (!payload) return { valid: false, reason: 'Malformed token' };

  // Verify it's an access token, not a refresh token
  // Supabase access tokens have aal/amr claims; refresh tokens have different structure
  if ((payload as any).aal === undefined && (payload as any).session_id === undefined) {
    return { valid: false, reason: 'Not an access token' };
  }

  // Verify audience claim — must be 'authenticated' for Supabase
  const aud = payload.aud;
  if (aud && aud !== 'authenticated') {
    return { valid: false, reason: 'Invalid audience claim' };
  }

  // Verify issuer claim must match Supabase project URL
  const iss = (payload as any).iss;
  if (iss) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl && !iss.startsWith(supabaseUrl)) {
      return { valid: false, reason: 'Invalid issuer' };
    }
  }

  // Verify role is 'authenticated'
  const role = (payload as any).role;
  if (role && role !== 'authenticated') {
    return { valid: false, reason: 'Invalid role claim' };
  }

  return { valid: true };
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  const claimCheck = validateTokenClaims(token);
  if (!claimCheck.valid) {
    Logger.warn('Token claim validation failed', {
      module: 'Auth',
      reason: claimCheck.reason,
      requestId: req.requestId,
    });
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token claims' });
    return;
  }

  const user = await verifyJwt(token);

  if (!user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  req.userToken = token;
  next();
}

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = crypto.randomUUID();
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    Logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.requestId,
      userId: req.user?.id,
    });
  });
  next();
}
