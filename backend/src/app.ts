/**
 * Express application factory.
 *
 * Kept separate from `server.ts` so that route logic can later be tested with
 * Jest + Supertest without opening a network port.
 */

import express from 'express';
import apiRouter from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // Unknown routes and central error handling (API contract §1.4).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
