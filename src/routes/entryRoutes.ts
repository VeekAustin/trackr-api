import { Router } from 'express';
import { createEntry, getEntries, deleteEntry, getEntryStats } from '../controllers/entryController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect); // every route below this requires a valid token

router.post('/', createEntry);
router.get('/', getEntries);
router.delete('/:id', deleteEntry);
router.get("/stats", protect, getEntryStats);

export default router;