import { Schema, model, type Document } from 'mongoose';
import { REFRESH_SESSION_STATUSES, type RefreshSessionStatus } from './types';
import { registerApiToJSON } from './serialize';

export interface RefreshSessionDoc extends Document {
  /** Owning user; deactivation revokes all of the user's sessions. */
  userId: Schema.Types.ObjectId;
  /** Token family — reuse detection revokes every token in the family. */
  familyId: Schema.Types.ObjectId;
  /** SHA-256 of the refresh token; raw tokens are never stored. */
  tokenHash: string;
  status: RefreshSessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new Schema<RefreshSessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    familyId: { type: Schema.Types.ObjectId, required: true },
    tokenHash: { type: String, required: [true, 'Token hash is required.'] },
    status: {
      type: String,
      enum: [...REFRESH_SESSION_STATUSES],
      default: 'active',
      required: true,
    },
    expiresAt: { type: Date, required: [true, 'Expiration is required.'] },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
// TTL: the session is removed automatically once expired (+7-day lifetime).
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshSessionSchema.index({ familyId: 1, status: 1 });
refreshSessionSchema.index({ userId: 1, status: 1 });

registerApiToJSON(refreshSessionSchema, { omit: ['tokenHash'] });

export const RefreshSession = model<RefreshSessionDoc>('RefreshSession', refreshSessionSchema);
