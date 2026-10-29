import { NextFunction, Request, Response } from 'express';
import { Track, ITrack } from '../models/Track';
import { Entry } from '../models/Entry';
import { AppError } from '../utils/AppError';
import { findOrFail, assertOwnership, isDuplicateKeyError } from '../utils/controllerHelpers';
import { cacheDel, cacheGet, cacheKeys, cacheSet } from "../utils/cache";

export const createTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color } = req.body;
    if (!name) throw new AppError('name is required', 400);

    const track = await Track.create({user: req.userId, name, color});
    await cacheDel(cacheKeys.tracks(req.userId!));
    res.status(201).json(track);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return next (new AppError('You already have a track with that name', 409));
    }
    next(error);
  }
};

export const getTracks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = cacheKeys.tracks(req.userId!);

    const cached = await cacheGet<unknown[]>(key);
    if (cached !== null) {
      res.set("X-Cache", "HIT").status(200).json(cached);
      return;
    }

    const tracks = await Track.find({ user: req.userId }).sort({ createdAt: 1 });
    await cacheSet(key, tracks);
    res.set("X-Cache", "MISS").status(200).json(tracks);
  } catch (error) {
    next(error);
  }
};

export const deleteTrack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const track = await findOrFail<ITrack>(Track, id, 'Track');
    assertOwnership(track.user, req.userId!, 'track');

    await Entry.deleteMany({ track: track._id });
    await track.deleteOne();
    await cacheDel(cacheKeys.tracks(req.userId!));
    res.status(200).json({ message: 'Track and its entries deleted' });
  } catch (error) {
    next(error);
  }
};