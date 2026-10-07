import { Request, Response, NextFunction } from 'express';
import { Entry, IEntry } from '../models/Entry';
import { AppError } from '../utils/AppError';
import { assertOwnership, findOrFail } from '../utils/controllerHelpers';

export const createEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { track, title, notes, date } = req.body;

    if (!track || !title || !date) {
      throw new AppError('track, title, and date are required', 400);
    }

    const entry = await Entry.create({ user: req.userId, track, title, notes, date });
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};

export const getEntries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await Entry.find({ user: req.userId }).sort({ date: -1 });
    res.status(200).json(entries);
  } catch (error) {
    next(error);
  }
};

export const deleteEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const entry = await findOrFail<IEntry>(Entry, id, 'Entry');
    assertOwnership(entry.user, req.userId!, 'entry');

    await entry.deleteOne();
    res.status(200).json({ message: 'Entry deleted' });
  } catch (error) {
    next(error);
  }
};