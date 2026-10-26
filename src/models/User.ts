import mongoose, { Schema, Document } from "mongoose";

export type Role = "user" | "admin";

export interface IUser extends Document {
  name: string;
  password: string;
  email: string;
  role: Role;
  createdAt: Date;
  passwordResetToken: String;
  passwordResetExpires:  Date;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
});

export const User = mongoose.model<IUser>("User", userSchema);
