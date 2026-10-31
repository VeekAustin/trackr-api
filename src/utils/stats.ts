const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

/** Add (or subtract) whole days from a YYYY-MM-DD string. Uses UTC so DST never shifts the result. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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