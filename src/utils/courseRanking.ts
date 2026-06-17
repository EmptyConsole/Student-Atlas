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

export function bookmarkedCourses(bookmarks: Set<string>): Course[] {
  return COURSES.filter((course) => bookmarks.has(course.id));
}

function sortByTitle(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

function isAnchorId(id: string, anchorSet: Set<string>): boolean {
  return anchorSet.has(id);
}

/** Placeholder ids are minted by deriveColumns; they are not real courses. */
function isPlaceholderId(id: string): boolean {
  return id.startsWith("ph-fall-") || id.startsWith("ph-spring-");
}

/** The band an anchor belongs to is keyed by the anchor immediately above it. */
function getBandKeyAbove(anchors: string[], anchorId: string): string {
  const idx = anchors.indexOf(anchorId);
  return idx <= 0 ? HEAD : anchors[idx - 1];
}

/**
 * How many blank placeholder rows the anchor crossed while being dragged up:
 * placeholders that sat above the anchor before and are below it now. Crossing
 * a placeholder means the anchor should move up one shared row, pulling a
 * course down from the taller column's band so both columns stay aligned.
 */
function countPlaceholderSteps(
  oldOrder: string[],
  newOrder: string[],
  anchorId: string,
): number {
  const oldIdx = oldOrder.indexOf(anchorId);
  const newIdx = newOrder.indexOf(anchorId);
  if (oldIdx === -1 || newIdx === -1) return 0;

  const aboveBefore = new Set(oldOrder.slice(0, oldIdx));
  let steps = 0;
  for (let i = newIdx + 1; i < newOrder.length; i += 1) {
    const id = newOrder[i];
    if (isPlaceholderId(id) && aboveBefore.has(id)) steps += 1;
  }
  return steps;
}

/**
 * Mirror of {@link countPlaceholderSteps} for downward drags: blank placeholder
 * rows that sat below the anchor before and are above it now. Each crossing
 * means the anchor should move down one shared row, pulling a course up from
 * the taller column's band below it so both columns stay aligned.
 */
function countPlaceholderStepsDown(
  oldOrder: string[],
  newOrder: string[],
  anchorId: string,
): number {
  const oldIdx = oldOrder.indexOf(anchorId);
  const newIdx = newOrder.indexOf(anchorId);
  if (oldIdx === -1 || newIdx === -1) return 0;

  const belowBefore = new Set(oldOrder.slice(oldIdx + 1));
  let steps = 0;
  for (let i = 0; i < newIdx; i += 1) {
    const id = newOrder[i];
    if (isPlaceholderId(id) && belowBefore.has(id)) steps += 1;
  }
  return steps;
}

/**
 * Move an anchor up within its band by pulling courses out of the taller
 * column's band and into the group directly below the anchor, one per step.
 * This shrinks the band on both sides so deriveColumns places the anchor on a
 * higher shared row in both columns.
 */
function moveAnchorUpInBand(
  model: RankingModel,
  bandKey: string,
  anchorId: string,
  steps: number,
): RankingModel {
  const fallGroups = { ...model.fallGroups };
  const springGroups = { ...model.springGroups };
  const fallBand = [...(fallGroups[bandKey] ?? [])];
  const springBand = [...(springGroups[bandKey] ?? [])];
  const fallAnchor = [...(fallGroups[anchorId] ?? [])];
  const springAnchor = [...(springGroups[anchorId] ?? [])];

  for (let i = 0; i < steps; i += 1) {
    if (fallBand.length === springBand.length) break;
    if (fallBand.length > springBand.length) {
      const moved = fallBand.pop();
      if (moved === undefined) break;
      fallAnchor.unshift(moved);
    } else {
      const moved = springBand.pop();
      if (moved === undefined) break;
      springAnchor.unshift(moved);
    }
  }

  fallGroups[bandKey] = fallBand;
  springGroups[bandKey] = springBand;
  fallGroups[anchorId] = fallAnchor;
  springGroups[anchorId] = springAnchor;
  return { ...model, fallGroups, springGroups };
}

/**
 * Move an anchor down within its band by pulling courses out of the taller
 * column's band directly below the anchor and into the band above it, one per
 * step. This grows the band above on both sides so deriveColumns places the
 * anchor on a lower shared row in both columns.
 */
function moveAnchorDownInBand(
  model: RankingModel,
  bandKey: string,
  anchorId: string,
  steps: number,
): RankingModel {
  const fallGroups = { ...model.fallGroups };
  const springGroups = { ...model.springGroups };
  const fallAbove = [...(fallGroups[bandKey] ?? [])];
  const springAbove = [...(springGroups[bandKey] ?? [])];
  const fallBelow = [...(fallGroups[anchorId] ?? [])];
  const springBelow = [...(springGroups[anchorId] ?? [])];

  for (let i = 0; i < steps; i += 1) {
    if (fallBelow.length === springBelow.length) break;
    if (fallBelow.length > springBelow.length) {
      const moved = fallBelow.shift();
      if (moved === undefined) break;
      fallAbove.push(moved);
    } else {
      const moved = springBelow.shift();
      if (moved === undefined) break;
      springAbove.push(moved);
    }
  }

  fallGroups[bandKey] = fallAbove;
  springGroups[bandKey] = springAbove;
  fallGroups[anchorId] = fallBelow;
  springGroups[anchorId] = springBelow;
  return { ...model, fallGroups, springGroups };
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

export function buildInitialModel(bookmarks: Set<string>): RankingModel {
  const eligible = bookmarkedCourses(bookmarks);
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
 * Reconcile an existing model with the current bookmarks: keep the relative
 * order of still-bookmarked courses, drop unbookmarked ones, and append newly
 * bookmarked courses alphabetically.
 */
export function mergeModelWithBookmarks(
  bookmarks: Set<string>,
  prevModel: RankingModel,
): RankingModel {
  const eligible = bookmarkedCourses(bookmarks);
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
 * Apply a drag reorder of one column. `newOrder` is the dragged column's full
 * row order including placeholder ids. When an anchor is dragged through blank
 * placeholder rows, courses are pulled across the taller column's bands so the
 * anchor moves to the same shared row in both columns: dragging up pulls
 * courses down from the band above, dragging down pulls courses up from the
 * band below. The dragged column is then regrouped from its real courses; the
 * other column keeps its own course order but adopts the new anchor order, so
 * linked courses stay locked at the same row in both columns.
 */
export function applyReorder(
  model: RankingModel,
  column: RankingColumnKey,
  newOrder: string[],
): RankingModel {
  const anchorSet = new Set(model.anchors);

  const { fallRows, springRows } = deriveColumns(model);
  const oldOrder = (column === "fall" ? fallRows : springRows).map(
    (row) => row.id,
  );
  let working = model;
  for (const anchor of model.anchors) {
    const bandKey = getBandKeyAbove(model.anchors, anchor);
    const stepsUp = countPlaceholderSteps(oldOrder, newOrder, anchor);
    if (stepsUp > 0) {
      working = moveAnchorUpInBand(working, bandKey, anchor, stepsUp);
    }
    const stepsDown = countPlaceholderStepsDown(oldOrder, newOrder, anchor);
    if (stepsDown > 0) {
      working = moveAnchorDownInBand(working, bandKey, anchor, stepsDown);
    }
  }

  const newFlatIds = newOrder.filter((id) => !isPlaceholderId(id));
  const newAnchors = newFlatIds.filter((id) => isAnchorId(id, anchorSet));
  const draggedGroups = regroup(newFlatIds, anchorSet);

  if (column === "fall") {
    return {
      anchors: newAnchors,
      fallGroups: draggedGroups,
      springGroups: working.springGroups,
    };
  }

  return {
    anchors: newAnchors,
    fallGroups: working.fallGroups,
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
