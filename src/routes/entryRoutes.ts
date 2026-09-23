import { Router } from 'express';
import { createEntry, getEntries, deleteEntry } from '../controllers/entryController';
import { protect } from '../middleware/authMiddleware';

const router = Router();

router.use(protect); // every route below this requires a valid token

router.post('/', createEntry);
router.get('/', getEntries);
router.delete('/:id', deleteEntry);

export default router;