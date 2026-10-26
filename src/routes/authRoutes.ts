import { Router} from "express";
import { signup, login, forgotPassword, resetPassword } from "../controllers/authController";
import { authLimiter, resetLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/forgot-password", resetLimiter, forgotPassword);
router.post("/reset-password", resetLimiter, resetPassword);
export default router;