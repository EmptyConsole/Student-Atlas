import { type Course } from "../data/courses";

/** Matches `schools.rankings` default when a school row is unavailable. */
export const DEFAULT_REQUIRED_RANKINGS = 8;

export type RankingRow =
  | { kind: "course"; id: string }
  | { kind: "spacer" };

/**
 * Per-term course order, keyed by term id. A course that spans multiple terms
 * ("linked") appears in each of those term's orders and is kept at the same
 * visual row across them by {@link deriveAlignedRows}.
 */
export type RankingModel = {
  orders: Record<string, string[]>;
};

/** One aligned display row: a cell (course or spacer) per term column. */
export type AlignedDisplayRow = {
  cells: Record<string, RankingRow>;
};

/** A course is "linked" (spans columns) when it covers more than one term. */
export function isLinkedCourse(course: Course): boolean {
  return course.termOptions.length > 1;
}

/** True if the course can be ranked in the given term column. */
export function eligibleForTerm(course: Course, termId: string): boolean {
  return course.termOptions.includes(termId);
}

export function bookmarkedCourses(
  bookmarks: Set<string>,
  courses: Course[],
): Course[] {
  return courses.filter((course) => bookmarks.has(course.id));
}

/** Ids of bookmarked courses that span more than one term. */
export function linkedIdSet(
  bookmarks: Set<string>,
  courses: Course[],
): Set<string> {
  return new Set(
    bookmarkedCourses(bookmarks, courses)
      .filter(isLinkedCourse)
      .map((course) => course.id),
  );
}

function sortByTitle(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Puts the linked courses of every column into one consistent global order so
 * they never "cross" between columns (which would make alignment impossible).
 * Regular (single-term) courses keep their positions; only linked entries are
 * permuted. The `priorityTerm` column defines the canonical linked order.
 */
function syncLinkedAcross(
  orders: Record<string, string[]>,
  termIds: string[],
  linkedSet: Set<string>,
  priorityTerm: string,
): Record<string, string[]> {
  // Canonical global order of linked ids: priority column first, then any
  // linked ids seen only in other columns.
  const globalLinked: string[] = [];
  const seen = new Set<string>();
  const pushLinked = (id: string) => {
    if (linkedSet.has(id) && !seen.has(id)) {
      seen.add(id);
      globalLinked.push(id);
    }
  };
  for (const id of orders[priorityTerm] ?? []) pushLinked(id);
  for (const termId of termIds) {
    for (const id of orders[termId] ?? []) pushLinked(id);
  }

  const next: Record<string, string[]> = {};
  for (const termId of termIds) {
    const order = orders[termId] ?? [];
    const present = globalLinked.filter((id) => order.includes(id));
    let idx = 0;
    next[termId] = order.map((id) =>
      linkedSet.has(id) ? present[idx++] ?? id : id,
    );
  }
  return next;
}

export function buildInitialModel(
  bookmarks: Set<string>,
  courses: Course[],
  termIds: string[],
): RankingModel {
  const eligible = bookmarkedCourses(bookmarks, courses);
  const linked = linkedIdSet(bookmarks, courses);
  const orders: Record<string, string[]> = {};
  for (const termId of termIds) {
    orders[termId] = sortByTitle(
      eligible.filter((course) => eligibleForTerm(course, termId)),
    ).map((course) => course.id);
  }
  return {
    orders: termIds.length
      ? syncLinkedAcross(orders, termIds, linked, termIds[0])
      : orders,
  };
}

export function mergeModelWithBookmarks(
  bookmarks: Set<string>,
  prevModel: RankingModel,
  courses: Course[],
  termIds: string[],
): RankingModel {
  const eligible = bookmarkedCourses(bookmarks, courses);
  const linked = linkedIdSet(bookmarks, courses);

  const mergeColumn = (
    prevOrder: string[],
    columnCourses: Course[],
  ): string[] => {
    const eligibleIds = new Set(columnCourses.map((course) => course.id));
    const kept = prevOrder.filter((id) => eligibleIds.has(id));
    const keptSet = new Set(kept);
    const added = sortByTitle(
      columnCourses.filter((course) => !keptSet.has(course.id)),
    ).map((course) => course.id);
    return [...kept, ...added];
  };

  const orders: Record<string, string[]> = {};
  for (const termId of termIds) {
    orders[termId] = mergeColumn(
      prevModel.orders[termId] ?? [],
      eligible.filter((course) => eligibleForTerm(course, termId)),
    );
  }
  return {
    orders: termIds.length
      ? syncLinkedAcross(orders, termIds, linked, termIds[0])
      : orders,
  };
}

/** Applies a drag reorder of one term column, keeping linked courses aligned. */
export function applyReorder(
  model: RankingModel,
  termId: string,
  newOrder: string[],
  termIds: string[],
  linkedSet: Set<string>,
): RankingModel {
  const orders: Record<string, string[]> = { ...model.orders, [termId]: newOrder };
  return {
    orders: syncLinkedAcross(orders, termIds, linkedSet, termId),
  };
}

/**
 * Builds row-aligned cells across all term columns. Linked courses are emitted
 * on a shared row in every column they belong to; regular courses fill the
 * remaining rows. Padding spacers keep columns the same height.
 */
export function deriveAlignedRows(
  model: RankingModel,
  termIds: string[],
  linkedSet: Set<string>,
): AlignedDisplayRow[] {
  const orders = model.orders;
  const pointers: Record<string, number> = {};
  for (const termId of termIds) pointers[termId] = 0;

  const remaining = () =>
    termIds.some((termId) => pointers[termId] < (orders[termId]?.length ?? 0));

  const rows: AlignedDisplayRow[] = [];
  const totalItems = termIds.reduce(
    (sum, termId) => sum + (orders[termId]?.length ?? 0),
    0,
  );
  let guard = 0;
  const maxIter = totalItems + termIds.length + 5;

  while (remaining() && guard < maxIter * 2) {
    guard += 1;

    const heads: Record<string, string | undefined> = {};
    for (const termId of termIds) {
      heads[termId] = orders[termId]?.[pointers[termId]];
    }

    const isReady = (id: string) => {
      const cols = termIds.filter((termId) =>
        (orders[termId] ?? []).includes(id),
      );
      return cols.length > 0 && cols.every((termId) => heads[termId] === id);
    };

    const cells: Record<string, RankingRow> = {};
    const advanceIds = new Set<string>();
    let advancedAny = false;

    for (const termId of termIds) {
      const head = heads[termId];
      if (head === undefined) {
        cells[termId] = { kind: "spacer" };
        continue;
      }
      if (linkedSet.has(head)) {
        if (isReady(head)) {
          cells[termId] = { kind: "course", id: head };
          advanceIds.add(head);
          advancedAny = true;
        } else {
          // A linked course not yet at the head of all its columns waits.
          cells[termId] = { kind: "spacer" };
        }
      } else {
        cells[termId] = { kind: "course", id: head };
        advanceIds.add(head);
        advancedAny = true;
      }
    }

    // Break a rare deadlock (crossed linked orders) by forcing progress.
    if (!advancedAny) {
      for (const termId of termIds) {
        const head = heads[termId];
        if (head !== undefined) {
          cells[termId] = { kind: "course", id: head };
          advanceIds.add(head);
        }
      }
    }

    for (const termId of termIds) {
      const head = heads[termId];
      if (head !== undefined && advanceIds.has(head)) {
        pointers[termId] += 1;
      }
    }

    rows.push({ cells });
  }

  return rows;
}

/** Course ids ranked in a term column, in order. */
export function columnIds(model: RankingModel, termId: string): string[] {
  return model.orders[termId] ?? [];
}

/** Linked (spanning) course ids, listed once, in first-seen column order. */
export function linkedCourseIds(
  model: RankingModel,
  termIds: string[],
  linkedSet: Set<string>,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const termId of termIds) {
    for (const id of model.orders[termId] ?? []) {
      if (linkedSet.has(id) && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function courseIds(rows: RankingRow[]): string[] {
  return rows
    .filter((row): row is { kind: "course"; id: string } => row.kind === "course")
    .map((row) => row.id);
}

/**
 * Valid when every term column has at least `requiredRankings` courses. Returns
 * per-term counts for messaging.
 */
export function validateRanking(
  model: RankingModel,
  termIds: string[],
  requiredRankings: number = DEFAULT_REQUIRED_RANKINGS,
): { valid: boolean; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  let valid = termIds.length > 0;
  for (const termId of termIds) {
    const count = (model.orders[termId] ?? []).length;
    counts[termId] = count;
    if (count < requiredRankings) valid = false;
  }
  return { valid, counts };
}
