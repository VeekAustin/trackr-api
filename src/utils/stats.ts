const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const HEATMAP_DAYS = 90;
export const WEEKS_SHOWN = 8;
export const MONTHS_SHOWN = 6;

/**
 * True for a real calendar date written as YYYY-MM-DD.
 * The round trip matters: Date silently rolls "2026-02-31" over to March 3,
 * so only a date that comes back unchanged is a real one.
 */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Add (or subtract) whole days from a YYYY-MM-DD string. Uses UTC so DST never shifts the result. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week a date falls in (weeks run Monday to Sunday). */
export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDate(date, -((weekday + 6) % 7));
}

function previousMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

/**
 * Current and longest streak of consecutive days with at least one entry.
 * `today` comes from the client so the streak follows the user's own calendar day.
 * A streak is still alive if the last active day was today or yesterday.
 */
export function computeStreaks(dates: string[], today: string) {
  const active = Array.from(new Set(dates.filter((d) => d <= today))).sort();
  const activeSet = new Set(active);

  let longestStreak = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of active) {
    run = previous !== null && shiftDate(previous, 1) === date ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = date;
  }

  let cursor = activeSet.has(today) ? today : shiftDate(today, -1);
  let currentStreak = 0;
  while (activeSet.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return { currentStreak, longestStreak };
}

export interface StatRow {
  date: string;
  track: string;
  count: number;
}

export interface TrackCount {
  track: string;
  count: number;
}

export interface PeriodBreakdown {
  key: string; // week: the Monday (YYYY-MM-DD). month: YYYY-MM
  total: number;
  byTrack: TrackCount[];
}

function addTo(bucket: Map<string, number> | undefined, track: string, count: number) {
  if (bucket) bucket.set(track, (bucket.get(track) ?? 0) + count);
}

function toPeriods(keys: string[], buckets: Map<string, Map<string, number>>): PeriodBreakdown[] {
  return keys.map((key) => {
    const byTrack = Array.from(buckets.get(key) ?? [], ([track, count]) => ({ track, count })).sort(
      (a, b) => b.count - a.count,
    );
    return { key, total: byTrack.reduce((sum, t) => sum + t.count, 0), byTrack };
  });
}

/** Entries per track for the last weeks and months, newest first. The current week and month are included. */
export function buildBreakdown(rows: StatRow[], today: string) {
  const weekKeys = Array.from({ length: WEEKS_SHOWN }, (_, i) => shiftDate(weekStart(today), -7 * i));
  const monthKeys: string[] = [today.slice(0, 7)];
  while (monthKeys.length < MONTHS_SHOWN) {
    monthKeys.push(previousMonth(monthKeys[monthKeys.length - 1]));
  }

  const weeks = new Map(weekKeys.map((key) => [key, new Map<string, number>()]));
  const months = new Map(monthKeys.map((key) => [key, new Map<string, number>()]));

  for (const row of rows) {
    if (row.date > today) continue;
    addTo(weeks.get(weekStart(row.date)), row.track, row.count);
    addTo(months.get(row.date.slice(0, 7)), row.track, row.count);
  }

  return { weeks: toPeriods(weekKeys, weeks), months: toPeriods(monthKeys, months) };
}

/** Everything the dashboard needs, from one row per (date, track). */
export function buildStats(rows: StatRow[], today: string) {
  const perDay = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    total += row.count;
    perDay.set(row.date, (perDay.get(row.date) ?? 0) + row.count);
  }

  const activeDates = Array.from(perDay.keys()).filter((date) => date <= today);
  const { currentStreak, longestStreak } = computeStreaks(activeDates, today);

  const windowStart = shiftDate(today, -(HEATMAP_DAYS - 1));
  const heatmap = Array.from(perDay, ([date, count]) => ({ date, count }))
    .filter((day) => day.date >= windowStart && day.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    total,
    activeDays: activeDates.length,
    currentStreak,
    longestStreak,
    heatmap,
    ...buildBreakdown(rows, today),
  };
}