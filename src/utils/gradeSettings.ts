/**
 * Per-grade elective settings.
 *
 * DB shape: `schools.grade` is a jsonb object keyed by grade number, whose
 * values hold the ranking/assignment counts for students in that grade:
 *
 *   { "9": { "rankings": "8", "assigned": "2" }, "12": { ... } }
 *
 * Counts are stored as strings, so every read coerces with Number(). A grade
 * missing from the object falls back to the school-wide `schools.rankings` /
 * `schools.electives_assigned` columns.
 */

/** Counts for one grade: courses to rank, and elective seats to assign. */
export type GradeSetting = { rankings: number; assigned: number };

/** Parsed `schools.grade`, keyed by grade number. */
export type GradeSettings = Map<number, GradeSetting>;

/** Serialized `schools.grade` value, matching the stored string-valued shape. */
export type GradeSettingsJson = Record<
  string,
  { rankings: string; assigned: string }
>;

function toCount(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

/** Read `schools.grade` into a lookup, skipping malformed grades and counts. */
export function parseGradeSettings(raw: unknown): GradeSettings {
  const settings: GradeSettings = new Map();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return settings;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const grade = toCount(key);
    if (grade === null) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;

    const entry = value as Record<string, unknown>;
    const rankings = toCount(entry.rankings);
    const assigned = toCount(entry.assigned);
    if (rankings === null && assigned === null) continue;

    settings.set(grade, { rankings: rankings ?? 0, assigned: assigned ?? 0 });
  }

  return settings;
}

/** Write a lookup back out in the string-valued shape the DB stores. */
export function serializeGradeSettings(
  settings: GradeSettings,
): GradeSettingsJson {
  const json: GradeSettingsJson = {};
  for (const grade of [...settings.keys()].sort((a, b) => a - b)) {
    const entry = settings.get(grade)!;
    json[String(grade)] = {
      rankings: String(entry.rankings),
      assigned: String(entry.assigned),
    };
  }
  return json;
}

/** Courses this grade must rank per term; `fallback` when the grade is unset. */
export function rankingsForGrade(
  settings: GradeSettings,
  grade: number | null,
  fallback: number,
): number {
  if (grade === null) return fallback;
  const entry = settings.get(grade);
  if (!entry || entry.rankings <= 0) return fallback;
  return entry.rankings;
}

/** Elective seats this grade gets per term; `fallback` when the grade is unset. */
export function assignedForGrade(
  settings: GradeSettings,
  grade: number | null,
  fallback: number,
): number {
  if (grade === null) return fallback;
  const entry = settings.get(grade);
  if (!entry) return fallback;
  return entry.assigned;
}

/** Flatten the assigned counts for the sort algorithm's per-grade quota map. */
export function assignedByGrade(
  settings: GradeSettings,
): Record<number, number> {
  const quotas: Record<number, number> = {};
  for (const [grade, entry] of settings) {
    quotas[grade] = entry.assigned;
  }
  return quotas;
}

/** Grade numbers configured in `schools.grade`, sorted ascending. */
export function gradesFromSettings(settings: GradeSettings): number[] {
  return [...settings.keys()].sort((a, b) => a - b);
}
