import { Request, Response, NextFunction } from 'express';
import { Entry } from '../models/Entry';
import { AppError } from '../utils/AppError';

export const createEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { track, title, notes, date } = req.body;

    if (!track || !title || !date) {
      throw new AppError ('track, title, and date are required', 400);
    }

    const entry = await Entry.create({
      user: req.userId,
      track,
      title,
      notes,
      date,
    });

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
    const { id } = req.params;

    const entry = await Entry.findById(id);
    if (!entry) {
      throw new AppError ('Entry not found', 404);
    }

    if (entry.user.toString() !== req.userId) {
      throw new AppError ('Not authorized to delete this entry', 403);
    }

    await entry.deleteOne();
    res.status(200).json ({ message: 'Entry deleted'});
  } catch (error) {
    next(error);
  }
};