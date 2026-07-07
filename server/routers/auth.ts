import { Router } from 'express';
import { z } from 'zod';
import { API_ERRORS } from '../types';
import { Logger } from '../services/logger';
import rateLimit from 'express-rate-limit';

const router = Router();

const signInSchema = z.object({
  email: z.string().email().or(z.string().endsWith('.local')).or(z.string().endsWith('.zerovault.local')),
  password: z.string().min(32),
});

const anonRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  message: { ...API_ERRORS.RATE_LIMITED, message: 'Too many anonymous sign-ins from this IP. Try again later.' },
});

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.post('/signin', async (req, res) => {
  try {
    const body = signInSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ ...API_ERRORS.VALIDATION_ERROR, details: body.error.issues });
      return;
    }

    const { signInDeterministic } = await import('../services/supabase');
    const result = await signInDeterministic(body.data.email, body.data.password);

    res.json({
      accessToken: result.session.access_token,
      refreshToken: result.session.refresh_token,
      expiresIn: result.session.expires_in,
      userId: result.user.id,
    });
  } catch (err: any) {
    Logger.error('Sign-in failed', err);
    res.status(502).json(API_ERRORS.SUPABASE_ERROR);
  }
});

router.get('/session', (req, res) => {
  if (!req.user) {
    res.status(401).json(API_ERRORS.UNAUTHORIZED);
    return;
  }
  res.json(req.user);
});

export { router as authRouter };
