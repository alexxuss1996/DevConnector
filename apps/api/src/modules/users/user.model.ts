import mongoose, { Schema } from "mongoose";

export interface IUser {
  name?: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, sparse: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
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
