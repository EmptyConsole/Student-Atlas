// Shared input sanitizers for /api handlers.
// Kept in api/ (not src/) so Vercel's function bundler includes it.

export const MAX_NAME_LENGTH = 200;
export const MAX_SHORT_TEXT = 300;
export const MAX_MEDIUM_TEXT = 500;
export const MAX_LONG_TEXT = 20_000;
export const MAX_NOTE_LENGTH = 5000;
export const MAX_WEBSITE_LENGTH = 300;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_LIST_LENGTH = 500;
export const MAX_REQ_GROUPS = 20;
export const MAX_REQ_ITEMS = 20;
export const MAX_REQ_ITEM_LENGTH = 200;
export const MAX_TERMS = 30;
export const MAX_OFFERINGS = 20;
export const MAX_TIMES = 20;
export const MAX_RANKINGS = 50;
export const MAX_ASSIGNED = 20;
export const MAX_DAY = 20;
export const MINUTES_PER_DAY = 24 * 60;
export const MAX_STUDENTS = 32_767;

/** C0/C1 controls except tab/newline — those stay for notes and descriptions. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Trim, drop control characters, collapse whitespace, and cap length. */
export function text(value: unknown, max = MAX_NAME_LENGTH): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Like {@link text}, but keeps newlines (descriptions, notes). */
export function longText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, max);
}

export function normalizeEmail(value: unknown): string {
  return text(value, MAX_EMAIL_LENGTH).toLowerCase();
}

/**
 * Standard shape check, minus `*`. PostgREST rewrites every `*` in a `like` /
 * `ilike` value to `%` before the pattern reaches Postgres, and it does so with
 * a blind character map — `\*` becomes `\%` — so a literal `*` can only be
 * refused, never escaped.
 */
export function isValidEmail(email: string): boolean {
  if (email.includes("*")) return false;
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isGrade(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 12;
}

export function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Empty is allowed (the column is NOT NULL). A scheme other than http(s) is
 * refused so `javascript:` / `data:` never land in the catalog.
 */
export function sanitizeWebsite(value: unknown): { website: string } | { error: string } {
  const raw = text(value, MAX_WEBSITE_LENGTH);
  if (!raw) return { website: "" };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) {
    return { error: "Website must be an http or https address." };
  }
  return { website: raw };
}

/** Re-parses `schools.grade` so only 0–12 keys and finite counts are stored. */
export function sanitizeGradeSettings(
  raw: unknown,
): Record<string, { rankings: string; assigned: string }> {
  const out: Record<string, { rankings: string; assigned: string }> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const grade = Number(key);
    if (!Number.isInteger(grade) || grade < 0 || grade > 12) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const entry = value as Record<string, unknown>;
    const rankings = countField(entry.rankings, MAX_RANKINGS);
    const assigned = countField(entry.assigned, MAX_ASSIGNED);
    if (rankings === null && assigned === null) continue;
    out[String(grade)] = {
      rankings: String(rankings ?? 0),
      assigned: String(assigned ?? 0),
    };
  }
  return out;
}

function countField(value: unknown, max: number): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(max, Math.floor(parsed));
}

export function sanitizeRankings(value: unknown, fallback = 8): number {
  return clampInt(value, fallback, 0, MAX_RANKINGS);
}

export function sanitizeGrades(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isGrade))].sort((a, b) => a - b).slice(0, 13);
}

/** Max enrollment; -1 means unknown / not set. */
export function sanitizeMaxStudents(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return -1;
  const n = Math.floor(value);
  if (n < 0) return -1;
  return Math.min(n, MAX_STUDENTS);
}

export type ClassTime = { day: number; start: number; end: number };

export function sanitizeClassTime(value: unknown): ClassTime | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Record<string, unknown>;
  if (!Number.isInteger(t.day) || !Number.isInteger(t.start) || !Number.isInteger(t.end)) {
    return null;
  }
  const day = t.day as number;
  const start = t.start as number;
  const end = t.end as number;
  if (day < 0 || day > MAX_DAY) return null;
  if (start < 0 || end > MINUTES_PER_DAY || start >= end) return null;
  return { day, start, end };
}

/** OR-of-AND groups of course UUIDs / free text. */
export function sanitizeReqOptions(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  const groups: string[][] = [];
  for (const group of value.slice(0, MAX_REQ_GROUPS)) {
    if (!Array.isArray(group)) continue;
    const items = group
      .map((item) => (isUuid(item) ? item : text(item, MAX_REQ_ITEM_LENGTH)))
      .filter((item) => item.length > 0)
      .slice(0, MAX_REQ_ITEMS);
    if (items.length > 0) groups.push(items);
  }
  return groups;
}

export function uuidList(value: unknown, max = MAX_LIST_LENGTH): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isUuid))].slice(0, max);
}

const MAX_GOOGLE_DOMAINS = 10;

/**
 * Lowercased, "@"-stripped, de-duplicated domains for `schools.google_domains`,
 * or a message naming the first invalid one.
 */
export function normalizeDomains(value: unknown): { domains: string[] } | { error: string } {
  if (!Array.isArray(value)) return { error: "Google sign-in domains must be a list." };
  const domains: string[] = [];
  for (const raw of value) {
    const domain = text(raw, 253).toLowerCase().replace(/^@/, "");
    if (!domain) continue;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
      return { error: `"${domain}" is not a valid domain.` };
    }
    if (!domains.includes(domain)) domains.push(domain);
  }
  if (domains.length > MAX_GOOGLE_DOMAINS) {
    return { error: `List at most ${MAX_GOOGLE_DOMAINS} Google sign-in domains.` };
  }
  return { domains };
}
