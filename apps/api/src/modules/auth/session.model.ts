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
  refreshTokenHash: { type: String, select: false },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model<ISession>("Session", sessionSchema);

export default Session;
