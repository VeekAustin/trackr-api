import { NextFunction, Request, Response } from "express";
import { User } from "../models/User";
import { hashPassword, comparePassword } from "../utils/hash";
import { generateToken } from "../utils/token";
import { AppError } from "../utils/AppError";

export const signup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      throw new AppError("All fields are required", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("Email already in use", 409);
  
    const hashedPassword = await hashPassword(password);
    const user = await User.create({name, email, password: hashedPassword,});

    res.status(200).json({
      message: "Account created successfully",
      user:{id:user._id, name:user.name, email:user.email}
    })

  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
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
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};