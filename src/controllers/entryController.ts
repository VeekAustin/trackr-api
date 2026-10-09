import { Request, Response, NextFunction } from "express";
import { Entry, IEntry } from "../models/Entry";
import { AppError } from "../utils/AppError";
import { assertOwnership, findOrFail } from "../utils/controllerHelpers";
import mongoose from 'mongoose';

export const createEntry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { track, title, notes, date } = req.body;

    if (!track || !title || !date) {
      throw new AppError("track, title, and date are required", 400);
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

export const getEntries = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const cursor = req.query.cursor as string | undefined;

    const query: any = {
      user: req.userId,
    };

    if (cursor) {
      const [createdAtString, id] = cursor.split("_");

      if (!createdAtString || !mongoose.isValidObjectId(id)) {
        throw new AppError("Invalid cursor", 400);
      }

      const createdAt = new Date(createdAtString);

      if (isNaN(createdAt.getTime())) {
        throw new AppError("Invalid cursor", 400);
      }

      query.$or = [
        {
          createdAt: {
            $lt: createdAt,
          },
        },
        {
          createdAt,
          _id: {
            $lt: id,
          },
        },
      ];
    }

    const entries = await Entry.find(query)
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .limit(limit + 1);

    const hasNextPage = entries.length > limit;

    if (hasNextPage) {
      entries.pop();
    }

    const lastEntry = entries[entries.length - 1];

    const nextCursor =
      hasNextPage && lastEntry
        ? `${lastEntry.createdAt.toISOString()}_${lastEntry._id.toString()}`
        : null;

    res.status(200).json({
      data: entries,
      nextCursor,
      hasNextPage,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEntry = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params.id as string;
    const entry = await findOrFail<IEntry>(Entry, id, "Entry");
    assertOwnership(entry.user, req.userId!, "entry");

    await entry.deleteOne();
    res.status(200).json({ message: "Entry deleted" });
  } catch (error) {
    next(error);
  }
};
