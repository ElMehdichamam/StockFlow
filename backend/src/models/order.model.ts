import { Schema, model, type Document } from 'mongoose';
import { ORDER_STATUSES, type OrderStatus } from './types';
import { registerApiToJSON, isInteger } from './serialize';

export interface OrderLine {
  productId: Schema.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  unitSellPriceCents: number;
  unitCostPriceCents: number;
  lineSellTotalCents: number;
}

export interface OrderCustomer {
  name: string;
  email?: string;
}

export interface OrderDoc extends Document {
  orderNumber: string;
  status: OrderStatus;
  customer: OrderCustomer;
  lines: OrderLine[];
  totalSellCents: number;
  totalCostCents: number;
  createdByUserId: Schema.Types.ObjectId;
  confirmedByUserId: Schema.Types.ObjectId | null;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Line snapshots (name, sku, prices) are immutable after creation;
// later product edits must never change them (contract §11 invariant 5).
const orderLineSchema = new Schema<OrderLine>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required.'],
    },
    productName: { type: String, required: [true, 'Product name snapshot is required.'], trim: true },
    sku: { type: String, required: [true, 'Product SKU snapshot is required.'], trim: true },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required.'],
      validate: {
        validator: (value: number) => isInteger(value) && value > 0,
        message: 'Quantity must be a positive integer.',
      },
    },
    unitSellPriceCents: { type: Number, required: [true, 'Unit selling price snapshot is required.'] },
    unitCostPriceCents: { type: Number, default: 0 },
    lineSellTotalCents: { type: Number, required: [true, 'Line total snapshot is required.'] },
  },
  { _id: false },
);

const nonnegative = (label: string) => ({
  validator: (value: number) => isInteger(value) && value >= 0,
  message: `${label} must be a nonnegative integer.`,
});

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required.'],
      match: [/^ORD-\d{6,}$/, 'Order number must match ORD- plus a numeric sequence.'],
    },
    status: {
      type: String,
      enum: { values: [...ORDER_STATUSES], message: '`{VALUE}` is not a valid order status.' },
      default: 'pending',
      required: true,
    },
    customer: {
      name: {
        type: String,
        required: [true, 'Customer name is required.'],
        trim: true,
        minLength: [1, 'Customer name cannot be empty.'],
        maxLength: [120, 'Customer name cannot exceed 120 characters.'],
      },
      email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true,
        maxLength: [200, 'Customer email cannot exceed 200 characters.'],
      },
    },
    // Document array as a path-level declaration so the custom validator
    // can enforce the whole-array rule (empty orders are invalid).
    lines: {
      type: [orderLineSchema],
      required: true,
      validate: {
        validator: (value: OrderLine[]) => value.length >= 1,
        message: 'An order must contain at least one product line.',
      },
    },
    totalSellCents: { type: Number, required: [true, 'Order total is required.'], validate: nonnegative('Order total') },
    totalCostCents: { type: Number, default: 0 },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    confirmedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ confirmedAt: -1, status: 1 });

registerApiToJSON(orderSchema);

export const Order = model<OrderDoc>('Order', orderSchema);
