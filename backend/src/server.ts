/**
 * Server entry point.
 *
 * Responsibilities only: load environment, start the HTTP server, kick off
 * the (non-blocking) MongoDB connection, and handle graceful shutdown.
 * No business logic lives here.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app';
import {
  connectDatabase,
  disconnectDatabase,
} from './config/db';
import { env } from './config/env';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(
    `[server] StockFlow backend listening on port ${env.port} (${env.nodeEnv})`,
  );
});

// Fire-and-forget: the server stays up and `/api/health` reports DB state.
connectDatabase();

function shutdown(signal: string): void {
  console.log(`[server] ${signal} received — shutting down gracefully`);

  server.close(async () => {
    try {
      await disconnectDatabase();
      process.exit(0);
    } catch (error) {
      console.error('[server] error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force-exit if connections do not drain in time.
  setTimeout(() => {
    void mongoose.disconnect();
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
