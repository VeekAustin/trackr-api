import { describe, it, expect } from "vitest";
import {
  buildBreakdown,
  buildStats,
  computeStreaks,
  isDateString,
  shiftDate,
  weekStart,
} from "./stats";

describe("shiftDate", () => {
  it("crosses month and year boundaries", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("handles leap days", () => {
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDate("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("isDateString", () => {
  it("accepts real dates and rejects everything else", () => {
    expect(isDateString("2026-10-30")).toBe(true);
    expect(isDateString("2026-13-45")).toBe(false);
    expect(isDateString("2026-1-5")).toBe(false);
    expect(isDateString("garbage")).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // Monday
    expect(weekStart("2026-10-20")).toBe("2026-10-19"); // Tuesday
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Sunday belongs to the week before the next Monday
    expect(weekStart("2026-10-26")).toBe("2026-10-26");
  });
});

describe("computeStreaks", () => {
  const today = "2026-10-20";

  it("returns zeros when there are no entries", () => {
    expect(computeStreaks([], today)).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("counts consecutive days ending today", () => {
    const dates = ["2026-10-18", "2026-10-19", "2026-10-20"];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it("keeps the streak alive when the last entry was yesterday", () => {
    const dates = ["2026-10-18", "2026-10-19"];
    expect(computeStreaks(dates, today).currentStreak).toBe(2);
  });

  it("resets the current streak after a missed day", () => {
    const dates = ["2026-10-16", "2026-10-17", "2026-10-18"];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 0, longestStreak: 3 });
  });

  it("finds the longest run across gaps", () => {
    const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-10-20"];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 1, longestStreak: 4 });
  });

  it("ignores duplicates and future dates", () => {
    const dates = ["2026-10-20", "2026-10-20", "2026-10-21", "2026-10-22"];
    expect(computeStreaks(dates, today)).toEqual({ currentStreak: 1, longestStreak: 1 });
  });
});

describe("buildBreakdown", () => {
  const today = "2026-10-20"; // a Tuesday
  const rows = [
    { date: "2026-10-18", track: "dev", count: 1 }, // Sunday: previous week
    { date: "2026-10-19", track: "dev", count: 1 },
    { date: "2026-10-20", track: "dev", count: 2 },
    { date: "2026-10-20", track: "teach", count: 1 },
    { date: "2026-06-01", track: "teach", count: 4 },
    { date: "2026-10-25", track: "dev", count: 9 }, // future: ignored
  ];

  it("lists 8 weeks and 6 months, newest first", () => {
    const { weeks, months } = buildBreakdown(rows, today);
    expect(weeks).toHaveLength(8);
    expect(weeks[0].key).toBe("2026-10-19");
    expect(weeks[1].key).toBe("2026-10-12");
    expect(months.map((m) => m.key)).toEqual([
      "2026-10", "2026-09", "2026-08", "2026-07", "2026-06", "2026-05",
    ]);
  });

  it("groups by track within each period, biggest first", () => {
    const { weeks, months } = buildBreakdown(rows, today);
    expect(weeks[0].total).toBe(4);
    expect(weeks[0].byTrack).toEqual([
      { track: "dev", count: 3 },
      { track: "teach", count: 1 },
    ]);
    expect(weeks[1]).toEqual({ key: "2026-10-12", total: 1, byTrack: [{ track: "dev", count: 1 }] });
    expect(months[0].total).toBe(5);
    expect(months[4]).toEqual({ key: "2026-06", total: 4, byTrack: [{ track: "teach", count: 4 }] });
  });

  it("returns empty periods when there is nothing in them", () => {
    const { weeks, months } = buildBreakdown([], today);
    expect(weeks.every((w) => w.total === 0 && w.byTrack.length === 0)).toBe(true);
    expect(months).toHaveLength(6);
  });

  it("rolls the month list back across a year boundary", () => {
    const { months } = buildBreakdown([], "2026-02-10");
    expect(months.map((m) => m.key)).toEqual([
      "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09",
    ]);
  });
});

describe("buildStats", () => {
  const today = "2026-10-20";
  const rows = [
    { date: "2026-10-18", track: "dev", count: 1 },
    { date: "2026-10-19", track: "dev", count: 1 },
    { date: "2026-10-20", track: "dev", count: 1 },
    { date: "2026-10-20", track: "teach", count: 1 },
    { date: "2026-06-01", track: "teach", count: 1 },
  ];

  it("combines totals, streaks, heatmap days and breakdowns", () => {
    const stats = buildStats(rows, today);
    expect(stats.total).toBe(5);
    expect(stats.activeDays).toBe(4);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.heatmap).toEqual([
      { date: "2026-10-18", count: 1 },
      { date: "2026-10-19", count: 1 },
      { date: "2026-10-20", count: 2 },
    ]);
    expect(stats.weeks[0].total).toBe(3);
    expect(stats.months[0].total).toBe(4);
  });
});