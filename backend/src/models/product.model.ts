import { Schema, model, type Document } from 'mongoose';
import { registerApiToJSON, isInteger } from './serialize';

export interface ProductImage {
  url: string;
  publicId: string;
}

export interface ProductDoc extends Document {
  sku: string;
  name: string;
  description: string;
  categoryId: Schema.Types.ObjectId;
  sellPriceCents: number;
  costPriceCents: number;
  stockQty: number;
  reservedQty: number;
  lowStockThreshold: number;
  image: ProductImage | null;
  isArchived: boolean;
  createdByUserId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productImageSchema = new Schema<ProductImage>(
  {
    // Cloudinary URL + public id; credentials never appear here.
    url: { type: String, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false },
);

const nonnegativeIntegerValidator = (label: string) => ({
  validator: (value: number) => isInteger(value) && value >= 0,
  message: `${label} must be a nonnegative integer.`,
});

const productSchema = new Schema<ProductDoc>(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required.'],
      trim: true,
      minLength: [2, 'SKU must be at least 2 characters.'],
      maxLength: [64, 'SKU cannot exceed 64 characters.'],
      // Canonical storage: always uppercase, so uniqueness is consistent.
      set: (value: string) => value.toUpperCase(),
    },
    name: {
      type: String,
      required: [true, 'Product name is required.'],
      trim: true,
      minLength: [1, 'Product name cannot be empty.'],
      maxLength: [200, 'Product name cannot exceed 200 characters.'],
    },
    description: { type: String, trim: true, maxLength: [2000, 'Description cannot exceed 2000 characters.'], default: '' },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required.'],
    },
    // Money as integer cents (USD) per the approved contract.
    sellPriceCents: {
      type: Number,
      required: [true, 'Selling price is required.'],
      validate: nonnegativeIntegerValidator('Selling price'),
    },
    // Admin-only read/write via the API layer. Employee-created products
    // start at 0 cost until an admin sets it (contract §4).
    costPriceCents: {
      type: Number,
      default: 0,
      validate: nonnegativeIntegerValidator('Cost price'),
    },
    // Physical on-hand quantity. Manual changes go through the adjustments
    // endpoint; `reservedQty` is only touched by order/adjustment services.
    stockQty: {
      type: Number,
      default: 0,
      validate: nonnegativeIntegerValidator('Stock quantity'),
    },
    // Units held by active (pending) orders. availableQty = stock - reserved.
    reservedQty: {
      type: Number,
      default: 0,
      validate: nonnegativeIntegerValidator('Reserved quantity'),
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      validate: nonnegativeIntegerValidator('Low-stock threshold'),
    },
    image: { type: productImageSchema, default: null },
    isArchived: { type: Boolean, default: false },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ isArchived: 1, categoryId: 1 });
productSchema.index({ isArchived: 1, stockQty: 1, reservedQty: 1 });

productSchema.virtual('availableQty').get(function (this: ProductDoc) {
  return Math.max(0, this.stockQty - this.reservedQty);
});

registerApiToJSON(productSchema, { virtuals: true });

export const Product = model<ProductDoc>('Product', productSchema);
