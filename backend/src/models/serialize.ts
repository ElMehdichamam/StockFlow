/**
 * Shared Mongoose `toJSON` serialization helpers.
 *
 * Per the API contract (§1.2), ObjectIds are serialized as `id` strings;
 * `_id` and `__v` are never exposed. Secret fields (password hash, refresh
 * token hashes) are removed via each model's `omit` list.
 */

import type { Schema } from 'mongoose';

export interface ApiRawDoc {
  [key: string]: any;
  id?: unknown;
  _id?: unknown;
  __v?: unknown;
}

export interface ApiJsonOptions {
  /** Include schema virtuals in JSON output (e.g. product.availableQty). */
  virtuals?: boolean;
  /** Secret or internal field names to remove from JSON output. */
  omit?: readonly string[];
}

export function registerApiToJSON(schema: Schema<any>, options: ApiJsonOptions = {}): void {
  const omit = options.omit ?? [];
  schema.set('toJSON', {
    virtuals: options.virtuals ?? false,
    versionKey: false,
    transform: (_doc: unknown, ret: unknown) => {
      const raw = ret as ApiRawDoc;
      for (const key of omit) {
        delete raw[key];
      }
      if (raw._id !== undefined && raw._id !== null) {
        raw.id = String(raw._id);
      }
      delete raw._id;
      delete raw.__v;
      return raw;
    },
  });
}

/** Nonnegative integer validator usable in schema field definitions. */
export function isInteger(value: unknown): boolean {
  return Number.isInteger(value);
}
