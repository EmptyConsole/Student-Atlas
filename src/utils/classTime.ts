/**
 * Class-time helpers.
 *
 * DB shape: courses.schedule is integer[][] of [day, start_minute, end_minute]
 * triples, minutes from midnight, start inclusive / end exclusive, ordered by
 * day then start. Day is a positional rotation-day number (not a weekday).
 */

export type ClassTime = { day: number; start: number; end: number };

/** Stable key matching the SQL helper `class_time_key`. */
export function classTimeKey(t: ClassTime): string {
  return `${t.day},${t.start},${t.end}`;
}

/** Parse a raw schedule array from Supabase into ClassTime objects. */
export function parseSchedule(
  raw: number[][] | null | undefined,
): ClassTime[] {
  if (!Array.isArray(raw)) return [];
  const result: ClassTime[] = [];
  for (const row of raw) {
    if (
      !Array.isArray(row) ||
      row.length < 3 ||
      typeof row[0] !== "number" ||
      typeof row[1] !== "number" ||
      typeof row[2] !== "number"
    ) {
      continue;
    }
    result.push({ day: row[0], start: row[1], end: row[2] });
  }
  return result;
}

/** Convert ClassTime objects to a sorted schedule array for the DB. */
export function toScheduleArray(times: ClassTime[]): number[][] {
  return [...times]
    .sort((a, b) => a.day - b.day || a.start - b.start)
    .map((t) => [t.day, t.start, t.end]);
}

/** Minutes from midnight -> "HH:MM" for `<input type="time">`. */
export function minutesToTimeValue(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.floor(min)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "HH:MM" from `<input type="time">` -> minutes from midnight, or null. */
export function timeValueToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/** Format minutes from midnight as a 12-hour clock string, e.g. "8:55 AM". */
function formatMinutesAmPm(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hours24 = Math.floor(clamped / 60) % 24;
  const minutes = clamped % 60;
  const period = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Human-readable label, e.g. "Day 1, 8:55 AM - 10:15 AM". */
export function formatClassTime(t: ClassTime): string {
  return `Day ${t.day}, ${formatMinutesAmPm(t.start)} - ${formatMinutesAmPm(t.end)}`;
}
