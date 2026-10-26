import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/token";
import { AppError } from "../utils/AppError";
import crypto from "crypto";
import { sendPasswordResetEmail } from "../utils/sendEmail";

export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new AppError("All fields are required", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("Email already in use", 409);

    const hashedPassword = await hashPassword(password);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      message: "Account created successfully",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Email and password required", 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

const RESET_TOKEN_MINUTES = 30;
const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      throw new AppError("Email is required", 400);
    }

    const reply = {
      message:
        "If an account exists for that email, a reset link has been sent.",
    };

    const user = await User.findOne({ email });
    if (!user) {
      res.status(200).json(reply);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(
      Date.now() + RESET_TOKEN_MINUTES * 60 * 1000,
    );
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      console.error("Password reset email failed:", mailError);
    }

    res.status(200).json(reply);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      throw new AppError("Token and new password are required", 400);
    }
    if (typeof password !== "string" || password.length < 8) {
      throw new AppError("Password must be at least 8 characters", 400);
    }

    const user = await User.findOne({
      passwordResetToken: hashToken(String(token)),
      passwordResetExpires: { $gt: new Date() },
    });
    if (!user) {
      throw new AppError("This reset link is invalid or has expired", 400);
    }

    user.password = await hashPassword(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password updated. You can now log in." });
  } catch (err) {
    next(err);
  }
};
