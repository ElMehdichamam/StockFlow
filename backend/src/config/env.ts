/**
 * Environment-variable loading and validation.
 *
 * Validation is fail-fast and runs at import time (before the app accepts
 * traffic): a misconfigured backend reports the missing variable clearly
 * instead of failing later with an opaque error.
 *
 * Add new variables here as integration work requires them, and keep
 * `.env.example` in sync. Never log or commit real values.
 */

const NODE_ENVS = ['development', 'test', 'production'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  nodeEnv: NodeEnv;
  port: number;
  mongoUri: string;
  frontendOrigin: string | null;
}

function requireValue(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name} (see backend/.env.example)`,
    );
  }
  return value.trim();
}

function requirePositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: "${raw}"`);
  }
  return parsed;
}

function requireNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV ?? 'development';
  if ((NODE_ENVS as readonly string[]).includes(raw) === false) {
    throw new Error(
      `NODE_ENV must be one of: ${NODE_ENVS.join(', ')} (got: "${raw}")`,
    );
  }
  return raw as NodeEnv;
}

function requireMongoUri(): string {
  const mongoUri = requireValue('MONGODB_URI');
  const looksLikeMongoUri =
    mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://');
  if (!looksLikeMongoUri) {
    throw new Error(
      'MONGODB_URI must start with mongodb:// or mongodb+srv://',
    );
  }
  return mongoUri;
}

function loadEnv(): Env {
  return {
    nodeEnv: requireNodeEnv(),
    port: requirePositiveInteger('PORT', 5000),
    mongoUri: requireMongoUri(),
    frontendOrigin: process.env['FRONTEND_ORIGIN']?.trim() || null,
  };
}

export const env: Env = loadEnv();
