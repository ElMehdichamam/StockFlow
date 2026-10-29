/**
 * MongoDB connection configuration (Mongoose).
 *
 * The connection is intentionally non-blocking at startup: the Express server
 * boots immediately and the health-check endpoint reports live database
 * state. Connection attempts are retried with a fixed delay so a temporarily
 * unavailable Atlas cluster or local replica set does not crash the process.
 *
 * Database credentials are only ever taken from MONGODB_URI via the validated
 * environment module, and are never logged (connection strings contain
 * secrets; we log state changes only).
 */

import mongoose from 'mongoose';
import { env } from './env';

const SERVER_SELECTION_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 5_000;

const READY_STATE_NAMES: Record<number, string> = {
  [mongoose.ConnectionStates.disconnected]: 'disconnected',
  [mongoose.ConnectionStates.connected]: 'connected',
  [mongoose.ConnectionStates.connecting]: 'connecting',
  [mongoose.ConnectionStates.disconnecting]: 'disconnecting',
  [mongoose.ConnectionStates.uninitialized]: 'uninitialized',
};

export function getDatabaseState(): string {
  return READY_STATE_NAMES[mongoose.connection.readyState] ?? 'unknown';
}

function registerConnectionEventLoggers(): void {
  mongoose.connection.on('connected', () => {
    console.log('[db] connected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[db] reconnected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected — auto-reconnect is active');
  });

  mongoose.connection.on('error', (error) => {
    // Log the message only; never the URI or any credentials.
    console.error('[db] connection error:', error.message);
  });
}

async function attemptConnect(attempt: number): Promise<void> {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'unknown error';
    console.error(
      `[db] connection attempt ${attempt} failed: ${message} — retrying in ${RETRY_DELAY_MS / 1000}s`,
    );
    setTimeout(() => {
      void attemptConnect(attempt + 1);
    }, RETRY_DELAY_MS);
  }
}

export function connectDatabase(): void {
  mongoose.set('strictQuery', true);
  registerConnectionEventLoggers();
  void attemptConnect(1);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
