import { rateLimit } from "express-rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const skipInTests = () => process.env.NODE_ENV === "test";
const message = { message: "Too many attempts. Please try again in 15 minutes." };

// Password-reset routes: tight, because they can trigger emails.
export const resetLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message,
});

// Login and signup: loose enough for real users, tight enough to slow guessing.
export const authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message,
});