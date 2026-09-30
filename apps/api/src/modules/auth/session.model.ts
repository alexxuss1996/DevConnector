import mongoose, { Schema, Types } from "mongoose";

export interface ISession {
  userId: Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}

const sessionSchema = new Schema<ISession>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    select: false,
    ref: "User",
  },
  refreshTokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1 });
// No index on `revokedAt`: every lookup filters on `_id` or `userId` first, and
// `$exists: false` cannot use an index, so it would only add write cost.

const Session = mongoose.model<ISession>("Session", sessionSchema);

export default Session;
