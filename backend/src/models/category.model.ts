import { Schema, model, type Document } from 'mongoose';
import { registerApiToJSON } from './serialize';

export interface CategoryDoc extends Document {
  name: string;
  isArchived: boolean;
  createdByUserId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required.'],
      trim: true,
      minLength: [1, 'Category name cannot be empty.'],
      maxLength: [100, 'Category name cannot exceed 100 characters.'],
    },
    // Referenced categories are never hard-deleted — archived instead.
    // Archiving does not affect existing products.
    isArchived: { type: Boolean, default: false },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

registerApiToJSON(categorySchema);

export const Category = model<CategoryDoc>('Category', categorySchema);
