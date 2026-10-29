import { Schema, model, type Document } from 'mongoose';
import { USER_ROLES, type UserRole } from './types';
import { registerApiToJSON } from './serialize';

export interface UserDoc extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema<UserDoc>(
  {
    // Stored lowercase; uniqueness is also case-insensitive via collation.
    email: {
      type: String,
      required: [true, 'Email is required.'],
      trim: true,
      lowercase: true,
      match: [emailRegex, 'Enter a valid email address.'],
    },
    // Argon2id hash only — plaintext passwords are never stored.
    passwordHash: { type: String, required: [true, 'Password hash is required.'] },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
      minLength: [1, 'Name cannot be empty.'],
      maxLength: [80, 'Name cannot exceed 80 characters.'],
    },
    // Public registration always sets 'employee'; promotion is admin-only.
    role: {
      type: String,
      enum: [...USER_ROLES],
      default: 'employee',
      required: true,
    },
    // Users are deactivated rather than deleted (preserves order history).
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

registerApiToJSON(userSchema, { omit: ['passwordHash'] });

export const User = model<UserDoc>('User', userSchema);
