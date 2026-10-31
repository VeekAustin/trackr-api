import { Request, Response, NextFunction } from "express";
import { Entry, IEntry } from "../models/Entry";
import { AppError } from "../utils/AppError";
import { assertOwnership, findOrFail } from "../utils/controllerHelpers";
import mongoose from "mongoose";
import {
  computeStreaks,
  isDateString,
  shiftDate,
  buildStats,
} from "../utils/stats";
import { Track, ITrack } from "../models/Track";

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
    if (!isDateString(date)) {
      throw new AppError("date must be a real date in YYYY-MM-DD format", 400);
    }

    if (typeof track !== "string" || !mongoose.isValidObjectId(track)) {
      throw new AppError("Invalid track id", 400);
    }

    // The track must exist and belong to the caller, or entries could be attached to other users' tracks.
    const ownedTrack = await findOrFail<ITrack>(Track, track, "Track");
    assertOwnership(ownedTrack.user, req.userId!, "track");

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
    const limit = Math.min(
      Math.max(Math.floor(Number(req.query.limit)) || 10, 1),
      50,
    );
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const query: Record<string, unknown> = { user: req.userId };

    if (cursor) {
      // Cursor format: "<date>_<entryId>", matching the sort order (date desc, _id desc)
      const [cursorDate, id] = cursor.split("_");

      if (!isDateString(cursorDate) || !mongoose.isValidObjectId(id)) {
        throw new AppError("Invalid cursor", 400);
      }

      query.$or = [
        { date: { $lt: cursorDate } },
        { date: cursorDate, _id: { $lt: id } },
      ];
    }

    const entries = await Entry.find(query)
      .sort({ date: -1, _id: -1 })
      .limit(limit + 1);

    const hasNextPage = entries.length > limit;
    if (hasNextPage) entries.pop();

    const lastEntry = entries[entries.length - 1];
    const nextCursor =
      hasNextPage && lastEntry
        ? `${lastEntry.date}_${lastEntry._id.toString()}`
        : null;

    res.status(200).json({ data: entries, nextCursor, hasNextPage });
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

const HEATMAP_DAYS = 90;

export const getEntryStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // The client sends its own calendar day so streaks follow the user's timezone.
    const today = isDateString(req.query.today)
      ? req.query.today
      : new Date().toISOString().slice(0, 10);

    // One row per (day, track). Aggregation pipelines don't cast ids, so convert explicitly.
    const grouped = await Entry.aggregate<{
      _id: { date: string; track: mongoose.Types.ObjectId };
      count: number;
    }>([
      { $match: { user: new mongoose.Types.ObjectId(req.userId) } },
      {
        $group: { _id: { date: "$date", track: "$track" }, count: { $sum: 1 } },
      },
    ]);

    const rows = grouped.map((row) => ({
      date: row._id.date,
      track: row._id.track.toString(),
      count: row.count,
    }));

    res.status(200).json(buildStats(rows, today));
  } catch (error) {
    next(error);
  }
};
