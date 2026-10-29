/**
 * Central error handling matching `docs/api-contract.md` §1.4:
 * every error response is `{ error: { code, message, details? } }`.
 *
 * Internal details (stack traces, database error payloads) are logged
 * server-side but never returned to clients. Routes only throw or forward
 * errors here; they do not build error envelopes themselves.
 */

import type { NextFunction, Request, Response } from 'express';

export interface HttpError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, string>;
}

export class ApiError extends Error implements HttpError {
  status: number;
  code: string;
  details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Resource not found: ${req.method} ${req.originalUrl}`,
    },
  });
}

export function errorHandler(
  error: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const handled = error instanceof ApiError;
  const status = receivedStatus(error);
  const code = error.code ?? (status === 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');

  if (!handled) {
    // Unexpected error: log it fully, but never expose internals to clients.
    console.error('[error] unhandled error:', error);
  }

  res.status(status).json({
    error: {
      code,
      message: status === 500 ? 'Unexpected server error.' : error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

function receivedStatus(error: HttpError): number {
  if (typeof error.status === 'number' && error.status >= 400 && error.status <= 599) {
    return error.status;
  }
  return 500;
}
