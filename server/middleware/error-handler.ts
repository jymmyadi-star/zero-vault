import type { Request, Response, NextFunction } from 'express';
import { Logger } from '../services/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  Logger.error('Unhandled error', err, {
    requestId: req.requestId,
    path: req.path,
    method: req.method,
  });

  if (res.headersSent) return;

  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId: req.requestId,
  });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}
