import { COURSES, type Course, type Term } from "../data/courses";

export const MIN_RANKED_COURSES = 8;

/** Sentinel key for the group of items above the first linked (all-year) course. */
const HEAD = "__head__";

export type RankingColumnKey = "fall" | "spring";

/**
 * A single rendered slot in a column. Placeholders keep linked (all-year)
 * courses on the same row in both columns when one side has fewer courses.
 */
export type RankingRow =
  | { kind: "course"; id: string }
  | { kind: "placeholder"; id: string };

/**
 * Source-of-truth ranking model. `anchors` are the all-year courses shared by
 * both columns (top to bottom). Each column stores its non-anchor courses
 * grouped by the anchor immediately above them (or HEAD for the top group).
 */
export type RankingModel = {
  anchors: string[];
  fallGroups: Record<string, string[]>;
  springGroups: Record<string, string[]>;
};

/** Only all-year courses are locked across columns. "both" is independent. */
export function isLinked(term: Term): boolean {
  return term === "all-year";
}

export function isFallEligible(term: Term): boolean {
  return term === "fall" || term === "both" || term === "all-year";
}

export function isSpringEligible(term: Term): boolean {
  return term === "spring" || term === "both" || term === "all-year";
}

export function coursesForGrade(grade: number): Course[] {
  return COURSES.filter((course) => course.grades.includes(grade));
}

function sortByTitle(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

function isAnchorId(id: string, anchorSet: Set<string>): boolean {
  return anchorSet.has(id);
}

/** Split a flat list (anchors interspersed) into groups keyed by the anchor above. */
function regroup(flat: string[], anchorSet: Set<string>): Record<string, string[]> {
  const groups: Record<string, string[]> = { [HEAD]: [] };
  let key = HEAD;
  for (const id of flat) {
    if (isAnchorId(id, anchorSet)) {
      key = id;
      if (!groups[key]) groups[key] = [];
    } else {
      (groups[key] ??= []).push(id);
    }
  }
  return groups;
}

/** Flatten a column back into a single ordered list of real course ids. */
function flattenColumn(model: RankingModel, column: RankingColumnKey): string[] {
  const groups = column === "fall" ? model.fallGroups : model.springGroups;
  const out = [...(groups[HEAD] ?? [])];
  for (const anchor of model.anchors) {
    out.push(anchor);
    out.push(...(groups[anchor] ?? []));
  }
  return out;
}

function buildModelFromColumns(
  fallFlat: string[],
  springFlat: string[],
  anchorSet: Set<string>,
): RankingModel {
  return {
    // Both columns share the same anchor order; derive from the fall column.
    anchors: fallFlat.filter((id) => isAnchorId(id, anchorSet)),
    fallGroups: regroup(fallFlat, anchorSet),
    springGroups: regroup(springFlat, anchorSet),
  };
}

export function buildInitialModel(
  grade: number,
  bookmarks: Set<string>,
): RankingModel {
  const eligible = coursesForGrade(grade).filter((course) =>
    bookmarks.has(course.id),
  );
  const anchorSet = new Set(
    eligible.filter((course) => isLinked(course.term)).map((course) => course.id),
  );

  const fallFlat = sortByTitle(
    eligible.filter((course) => isFallEligible(course.term)),
  ).map((course) => course.id);
  const springFlat = sortByTitle(
    eligible.filter((course) => isSpringEligible(course.term)),
  ).map((course) => course.id);

  return buildModelFromColumns(fallFlat, springFlat, anchorSet);
}

/**
 * Reconcile an existing model with the current bookmarks/grade: keep the
 * relative order of still-valid courses, drop ones no longer bookmarked or
 * eligible, and append newly bookmarked courses alphabetically.
 */
export function mergeModelWithBookmarks(
  grade: number,
  bookmarks: Set<string>,
  prevModel: RankingModel,
): RankingModel {
  const eligible = coursesForGrade(grade).filter((course) =>
    bookmarks.has(course.id),
  );
  const anchorSet = new Set(
    eligible.filter((course) => isLinked(course.term)).map((course) => course.id),
  );

  const mergeColumn = (prevFlat: string[], columnCourses: Course[]): string[] => {
    const eligibleIds = new Set(columnCourses.map((course) => course.id));
    const kept = prevFlat.filter((id) => eligibleIds.has(id));
    const keptSet = new Set(kept);
    const added = sortByTitle(
      columnCourses.filter((course) => !keptSet.has(course.id)),
    ).map((course) => course.id);
    return [...kept, ...added];
  };

  const fallFlat = mergeColumn(
    flattenColumn(prevModel, "fall"),
    eligible.filter((course) => isFallEligible(course.term)),
  );
  const springFlat = mergeColumn(
    flattenColumn(prevModel, "spring"),
    eligible.filter((course) => isSpringEligible(course.term)),
  );

  return buildModelFromColumns(fallFlat, springFlat, anchorSet);
}

/**
 * Apply a drag reorder of one column. `newFlatIds` is the dragged column's real
 * course ids in their new order (placeholders already stripped). The other
 * column keeps its own course order but adopts the new anchor order, so linked
 * courses stay locked at the same row in both columns.
 */
export function applyReorder(
  model: RankingModel,
  column: RankingColumnKey,
  newFlatIds: string[],
): RankingModel {
  const anchorSet = new Set(model.anchors);
  const newAnchors = newFlatIds.filter((id) => isAnchorId(id, anchorSet));
  const draggedGroups = regroup(newFlatIds, anchorSet);

  if (column === "fall") {
    return {
      anchors: newAnchors,
      fallGroups: draggedGroups,
      springGroups: model.springGroups,
    };
  }

  return {
    anchors: newAnchors,
    fallGroups: model.fallGroups,
    springGroups: draggedGroups,
  };
}

/**
 * Derive the two columns of rendered rows, padding each band so that linked
 * (all-year) courses land on the same row in both columns.
 */
export function deriveColumns(model: RankingModel): {
  fallRows: RankingRow[];
  springRows: RankingRow[];
} {
  const fallRows: RankingRow[] = [];
  const springRows: RankingRow[] = [];

  const emitBand = (
    bandKey: string,
    fallItems: string[],
    springItems: string[],
  ) => {
    const rows = Math.max(fallItems.length, springItems.length);
    for (let i = 0; i < rows; i += 1) {
      fallRows.push(
        i < fallItems.length
          ? { kind: "course", id: fallItems[i] }
          : { kind: "placeholder", id: `ph-fall-${bandKey}-${i}` },
      );
      springRows.push(
        i < springItems.length
          ? { kind: "course", id: springItems[i] }
          : { kind: "placeholder", id: `ph-spring-${bandKey}-${i}` },
      );
    }
  };

  emitBand(HEAD, model.fallGroups[HEAD] ?? [], model.springGroups[HEAD] ?? []);

  for (const anchor of model.anchors) {
    fallRows.push({ kind: "course", id: anchor });
    springRows.push({ kind: "course", id: anchor });
    emitBand(
      anchor,
      model.fallGroups[anchor] ?? [],
      model.springGroups[anchor] ?? [],
    );
  }

  return { fallRows, springRows };
}

/** Real course ids (no placeholders) for a column, in render order. */
export function courseIds(rows: RankingRow[]): string[] {
  return rows.filter((row) => row.kind === "course").map((row) => row.id);
}

export function validateRanking(
  fallRows: RankingRow[],
  springRows: RankingRow[],
): { valid: boolean; fallCount: number; springCount: number } {
  const fallCount = courseIds(fallRows).length;
  const springCount = courseIds(springRows).length;
  return {
    valid: fallCount >= MIN_RANKED_COURSES && springCount >= MIN_RANKED_COURSES,
    fallCount,
    springCount,
  };
}
