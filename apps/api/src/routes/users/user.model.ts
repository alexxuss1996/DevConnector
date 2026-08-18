import mongoose, { Schema } from "mongoose";

export interface IUser {
  username?: string;
  email: string;
  isOnboarded: boolean;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, sparse: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isOnboarded: { type: Boolean, default: false },
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, unique: true, select: false },
    avatar: { type: String },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;
