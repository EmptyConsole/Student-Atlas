import { describe, expect, it } from "vitest";
import type { Course } from "../data/courses";
import {
  applyReorder,
  buildInitialModel,
  columnIds,
  deriveAlignedRows,
  linkedCourseIds,
  linkedIdSet,
  mergeModelWithBookmarks,
  validateRanking,
  type RankingModel,
} from "./courseRanking";

const TERM_IDS = ["fall", "spring"];

function mk(id: string, termOptions: string[]): Course {
  return {
    id,
    subject: "Test",
    title: id,
    grades: [9],
    retakeable: false,
    termOptions,
    shortDescription: "",
    longDescription: "",
  };
}

// A small catalog: fall-only, spring-only, and linked (both) courses.
const COURSES: Course[] = [
  mk("f1", ["fall"]),
  mk("f2", ["fall"]),
  mk("s1", ["spring"]),
  mk("s2", ["spring"]),
  mk("A1", ["fall", "spring"]),
  mk("A2", ["fall", "spring"]),
];

function moveItemTo(order: string[], id: string, target: number): string[] {
  const idx = order.indexOf(id);
  const next = [...order];
  next.splice(idx, 1);
  next.splice(target, 0, id);
  return next;
}

describe("buildInitialModel", () => {
  it("places eligible bookmarked courses in each term column, sorted by title", () => {
    const bookmarks = new Set(["f2", "f1", "s1", "A1"]);
    const model = buildInitialModel(bookmarks, COURSES, TERM_IDS);
    expect(model.orders.fall).toEqual(["A1", "f1", "f2"]);
    expect(model.orders.spring).toEqual(["A1", "s1"]);
  });
});

describe("mergeModelWithBookmarks", () => {
  it("preserves order for kept courses and appends new ones", () => {
    const bookmarks = new Set(["f1", "f2", "s1"]);
    const prev: RankingModel = {
      orders: { fall: ["f2"], spring: [] },
    };
    const next = mergeModelWithBookmarks(bookmarks, prev, COURSES, TERM_IDS);
    expect(next.orders.fall).toEqual(["f2", "f1"]);
    expect(next.orders.spring).toEqual(["s1"]);
  });
});

describe("applyReorder", () => {
  it("reorders the edited column and keeps linked courses aligned in others", () => {
    const bookmarks = new Set(["f1", "f2", "s1", "A1"]);
    const linked = linkedIdSet(bookmarks, COURSES);
    const model = buildInitialModel(bookmarks, COURSES, TERM_IDS);

    // Move A1 to the end of the fall column.
    const dragged = moveItemTo(model.orders.fall, "A1", model.orders.fall.length - 1);
    const next = applyReorder(model, "fall", dragged, TERM_IDS, linked);

    // A1 stays last among the linked entries in spring too.
    const fallLinkedIdx = next.orders.fall.indexOf("A1");
    expect(fallLinkedIdx).toBe(next.orders.fall.length - 1);
    expect(next.orders.spring).toContain("A1");
  });
});

describe("deriveAlignedRows", () => {
  it("puts a linked course on the same row in both columns", () => {
    const bookmarks = new Set(["f1", "s1", "A1"]);
    const linked = linkedIdSet(bookmarks, COURSES);
    const model = buildInitialModel(bookmarks, COURSES, TERM_IDS);
    const rows = deriveAlignedRows(model, TERM_IDS, linked);

    const linkedRow = rows.findIndex(
      (row) => row.cells.fall.kind === "course" && row.cells.fall.id === "A1",
    );
    expect(linkedRow).toBeGreaterThanOrEqual(0);
    const cell = rows[linkedRow].cells.spring;
    expect(cell).toEqual({ kind: "course", id: "A1" });
  });
});

describe("linkedCourseIds", () => {
  it("lists spanning courses once", () => {
    const bookmarks = new Set(["f1", "s1", "A1", "A2"]);
    const linked = linkedIdSet(bookmarks, COURSES);
    const model = buildInitialModel(bookmarks, COURSES, TERM_IDS);
    expect(linkedCourseIds(model, TERM_IDS, linked).sort()).toEqual(["A1", "A2"]);
  });
});

describe("validateRanking", () => {
  it("requires the configured number of courses in every term", () => {
    const model: RankingModel = {
      orders: {
        fall: ["a", "b", "c"],
        spring: ["d", "e"],
      },
    };
    // spring only has 2, so requiring 3 fails.
    expect(validateRanking(model, TERM_IDS, 3).valid).toBe(false);
    expect(validateRanking(model, TERM_IDS, 3).counts.fall).toBe(3);
    // both columns meet a requirement of 2.
    expect(validateRanking(model, TERM_IDS, 2).valid).toBe(true);
  });
});

describe("columnIds", () => {
  it("returns the order for a term, or empty", () => {
    const model: RankingModel = { orders: { fall: ["x"] } };
    expect(columnIds(model, "fall")).toEqual(["x"]);
    expect(columnIds(model, "spring")).toEqual([]);
  });
});
