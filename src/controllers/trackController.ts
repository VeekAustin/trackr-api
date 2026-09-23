import { NextFunction, Request, Response } from 'express';
import { Track } from '../models/Track';
import { Entry } from '../models/Entry';
import { AppError } from '../utils/AppError';

export const createTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      throw new AppError('name is required', 400);
    }

    const track = await Track.create({
      user: req.userId,
      name,
      color,
    });

    res.status(201).json(track);
  } catch (error: any) {
    if (error.code === 11000) {
      throw new AppError('You already have a track with that name', 409);
    }
    next(error);
  }
};

export const getTracks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tracks = await Track.find({ user: req.userId }).sort({ createdAt: 1 });
    res.status(200).json(tracks);
  } catch (error) {
    next(error);
  }
};

export const deleteTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const track = await Track.findById(id);
    if (!track) {
      throw new AppError('Track not found', 404);
    }

    if (track.user.toString() !== req.userId) {
      throw new AppError('Not authorized to delete this track', 403);
    }

    // cascade: remove every entry that belongs to this track
    await Entry.deleteMany({ track: track._id });
    await track.deleteOne();

    res.status(200).json({ message: 'Track and its entries deleted' });
  } catch (error) {
    next(error);
  }
};