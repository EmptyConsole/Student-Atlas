import { type Course, type Term } from "../data/courses";

export const MIN_RANKED_COURSES = 8;

/** Internal padding token so both columns share row indices for all-year courses. */
export const ALIGN_PAD = "__align_pad__";

export type RankingColumnKey = "fall" | "spring";

export type RankingRow =
  | { kind: "course"; id: string }
  | { kind: "spacer" };

/** Per-column course order. All-year courses share the same index in both columns. */
export type RankingModel = {
  fallOrder: string[];
  springOrder: string[];
};

export type AlignedDisplayRow = {
  fall: RankingRow;
  spring: RankingRow;
};

/** Only all-year courses are linked across columns. "both" is independent. */
export function isLinked(term: Term): boolean {
  return term === "all-year";
}

export function isFallEligible(term: Term): boolean {
  return term === "fall" || term === "both" || term === "all-year";
}

export function isSpringEligible(term: Term): boolean {
  return term === "spring" || term === "both" || term === "all-year";
}

export function bookmarkedCourses(bookmarks: Set<string>, courses: Course[]): Course[] {
  return courses.filter((course) => bookmarks.has(course.id));
}

export function yearLongIdSet(bookmarks: Set<string>, courses: Course[]): Set<string> {
  return new Set(
    bookmarkedCourses(bookmarks, courses)
      .filter((course) => isLinked(course.term))
      .map((course) => course.id),
  );
}

function sortByTitle(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => a.title.localeCompare(b.title));
}

function isPlaceholderId(id: string): boolean {
  return id.startsWith("ph-fall-") || id.startsWith("ph-spring-");
}

export function isAlignPad(id: string): boolean {
  return id === ALIGN_PAD;
}

function isRenderableId(id: string): boolean {
  return !isPlaceholderId(id) && !isAlignPad(id);
}

export function realCourseIds(order: string[]): string[] {
  return order.filter(isRenderableId);
}

/**
 * After one column is edited, place each shared all-year course in the other
 * column at the same index. Remaining courses keep their relative order.
 */
export function syncYearLongPositions(
  editedOrder: string[],
  otherOrder: string[],
  yearLongSet: Set<string>,
): string[] {
  const otherRegular = realCourseIds(otherOrder).filter((id) => !yearLongSet.has(id));

  const slotByYearLong = new Map<string, number>();
  for (let i = 0; i < editedOrder.length; i += 1) {
    const id = editedOrder[i];
    if (yearLongSet.has(id)) {
      slotByYearLong.set(id, i);
    }
  }

  const slotCount = Math.max(
    editedOrder.length,
    otherRegular.length + slotByYearLong.size,
  );

  const slots: (string | null)[] = new Array(slotCount).fill(null);

  for (const [id, idx] of slotByYearLong) {
    if (otherOrder.includes(id) || yearLongSet.has(id)) {
      slots[idx] = id;
    }
  }

  let regularIdx = 0;
  for (let i = 0; i < slotCount; i += 1) {
    if (slots[i] === null) {
      if (regularIdx < otherRegular.length) {
        slots[i] = otherRegular[regularIdx];
        regularIdx += 1;
      } else {
        slots[i] = ALIGN_PAD;
      }
    }
  }

  const result = slots.map((id) => id ?? ALIGN_PAD);
  while (result.length > 0 && isAlignPad(result[result.length - 1])) {
    result.pop();
  }
  return result;
}

function alignModel(
  model: RankingModel,
  yearLongSet: Set<string>,
): RankingModel {
  if (yearLongSet.size === 0) return model;
  return {
    fallOrder: model.fallOrder,
    springOrder: syncYearLongPositions(
      model.fallOrder,
      model.springOrder,
      yearLongSet,
    ),
  };
}

export function buildInitialModel(bookmarks: Set<string>, courses: Course[]): RankingModel {
  const eligible = bookmarkedCourses(bookmarks, courses);
  const yearLongSet = yearLongIdSet(bookmarks, courses);
  const fallOrder = sortByTitle(
    eligible.filter((course) => isFallEligible(course.term)),
  ).map((course) => course.id);
  const springOrder = sortByTitle(
    eligible.filter((course) => isSpringEligible(course.term)),
  ).map((course) => course.id);
  return alignModel({ fallOrder, springOrder }, yearLongSet);
}

export function mergeModelWithBookmarks(
  bookmarks: Set<string>,
  prevModel: RankingModel,
  courses: Course[],
): RankingModel {
  const eligible = bookmarkedCourses(bookmarks, courses);
  const yearLongSet = yearLongIdSet(bookmarks, courses);

  const mergeColumn = (prevOrder: string[], columnCourses: Course[]): string[] => {
    const eligibleIds = new Set(columnCourses.map((course) => course.id));
    const kept = prevOrder.filter((id) => eligibleIds.has(id));
    const keptSet = new Set(kept);
    const added = sortByTitle(
      columnCourses.filter((course) => !keptSet.has(course.id)),
    ).map((course) => course.id);
    return [...kept, ...added];
  };

  return alignModel(
    {
      fallOrder: mergeColumn(
        prevModel.fallOrder,
        eligible.filter((course) => isFallEligible(course.term)),
      ),
      springOrder: mergeColumn(
        prevModel.springOrder,
        eligible.filter((course) => isSpringEligible(course.term)),
      ),
    },
    yearLongSet,
  );
}

export function applyReorder(
  model: RankingModel,
  column: RankingColumnKey,
  newOrder: string[],
  yearLongSet: Set<string>,
): RankingModel {
  const order = newOrder.filter(isRenderableId);

  if (column === "fall") {
    return {
      fallOrder: order,
      springOrder: syncYearLongPositions(order, model.springOrder, yearLongSet),
    };
  }

  return {
    fallOrder: syncYearLongPositions(order, model.fallOrder, yearLongSet),
    springOrder: order,
  };
}

/** Row-aligned fall/spring cells for a shared grid (spacers pad the shorter side). */
export function deriveAlignedRows(model: RankingModel): AlignedDisplayRow[] {
  const rowCount = Math.max(model.fallOrder.length, model.springOrder.length);
  const rows: AlignedDisplayRow[] = [];

  for (let i = 0; i < rowCount; i += 1) {
    const fallId = model.fallOrder[i];
    const springId = model.springOrder[i];

    rows.push({
      fall:
        fallId && isRenderableId(fallId)
          ? { kind: "course", id: fallId }
          : { kind: "spacer" },
      spring:
        springId && isRenderableId(springId)
          ? { kind: "course", id: springId }
          : { kind: "spacer" },
    });
  }

  return rows;
}

export function deriveColumns(model: RankingModel): {
  fallRows: RankingRow[];
  springRows: RankingRow[];
} {
  return {
    fallRows: realCourseIds(model.fallOrder).map((id) => ({ kind: "course", id })),
    springRows: realCourseIds(model.springOrder).map((id) => ({ kind: "course", id })),
  };
}

export function yearLongCourseIds(
  bookmarks: Set<string>,
  fallOrder: string[],
  springOrder: string[],
  courses: Course[],
): string[] {
  const linkedSet = yearLongIdSet(bookmarks, courses);
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [...fallOrder, ...springOrder]) {
    if (linkedSet.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function courseIds(rows: RankingRow[]): string[] {
  return rows
    .filter((row): row is { kind: "course"; id: string } => row.kind === "course")
    .map((row) => row.id);
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
