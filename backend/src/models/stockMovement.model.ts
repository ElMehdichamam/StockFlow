import { Schema, model, type Document } from 'mongoose';
import { MOVEMENT_TYPES, type MovementType } from './types';
import { registerApiToJSON, isInteger } from './serialize';

export interface StockMovementDoc extends Document {
  productId: Schema.Types.ObjectId;
  type: MovementType;
  /** Signed change to physical stock. */
  quantityDelta: number;
  /** Signed change to reserved quantity. */
  reservedDelta: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string;
  orderId: Schema.Types.ObjectId | null;
  actorUserId: Schema.Types.ObjectId;
  createdAt: Date;
}

const movementSchema = new Schema<StockMovementDoc>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required.'],
    },
    type: {
      type: String,
      enum: [...MOVEMENT_TYPES],
      required: [true, 'Movement type is required.'],
    },
    quantityDelta: {
      type: Number,
      required: [true, 'Quantity delta is required.'],
      validate: {
        // Nonzero applies to manual adjustments only (contract §6);
        // order movements legitimately use 0 (e.g. reservations).
        validator: function (this: StockMovementDoc, value: number) {
          return isInteger(value) && (this.type !== 'manual_adjustment' || value !== 0);
        },
        message: 'Manual adjustment delta must be a nonzero integer.',
      },
    },
    reservedDelta: {
      type: Number,
      default: 0,
      validate: {
        validator: (value: number) => isInteger(value),
        message: 'Reserved delta must be an integer.',
      },
    },
    stockBefore: { type: Number, required: true },
    stockAfter: { type: Number, required: true },
    // Required for manual adjustments; order movements derive the cause.
    reason: {
      type: String,
      trim: true,
      maxLength: [500, 'Reason cannot exceed 500 characters.'],
      required: [
        function (this: StockMovementDoc) {
          return this.type === 'manual_adjustment';
        },
        'A reason is required for manual stock adjustments.',
      ],
    },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor is required.'],
    },
  },
  {
    // Movements are immutable: createdAt only, never updatedAt, and they are
    // only ever inserted (no update/delete endpoints per contract §6).
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
  },
);

movementSchema.index({ productId: 1, createdAt: -1 });
movementSchema.index({ orderId: 1 });
movementSchema.index({ type: 1, createdAt: -1 });

registerApiToJSON(movementSchema);

export const StockMovement = model<StockMovementDoc>('StockMovement', movementSchema);
