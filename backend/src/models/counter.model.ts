/**
 * `counters` collection — atomic, gap-free sequence for human-readable order
 * numbers (`ORD-` + zero-padded sequence), per contract §12 item 2.
 *
 * `nextOrderNumber` is called inside the same transaction that creates the
 * order (the caller passes the session), so counters, reservations, movement
 * rows, and the order document commit or roll back together. A rolled-back
 * transaction rolls back the `$inc` too, so numbers never gap or collide —
 * the unique index on `orders.orderNumber` is the final safety net.
 */

import { Schema, model, type ClientSession, type Document } from 'mongoose';

export interface CounterDoc extends Document {
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  key: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

counterSchema.index({ key: 1 }, { unique: true });

export const Counter = model<CounterDoc>('Counter', counterSchema);

const ORDER_NUMBER_KEY = 'orderNumber';
const MIN_ORDER_NUMBER_DIGITS = 6;

export async function nextOrderNumber(session?: ClientSession): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { key: ORDER_NUMBER_KEY },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  if (!counter) {
    throw new Error('Order-number counter could not be created.');
  }

  return `ORD-${String(counter.seq).padStart(MIN_ORDER_NUMBER_DIGITS, '0')}`;
}
