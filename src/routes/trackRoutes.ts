import { Router } from "express";
import { createTrack, getTracks, deleteTrack } from "../controllers/trackController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect); // Apply the protect middleware to all routes in this router

router.post("/", createTrack);
router.get("/", getTracks);
router.delete("/:id", deleteTrack);

export default router;