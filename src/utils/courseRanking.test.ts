import { describe, expect, it } from "vitest";
import { COURSES } from "../data/courses";
import {
  applyReorder,
  buildInitialModel,
  courseIds,
  deriveAlignedRows,
  deriveColumns,
  mergeModelWithBookmarks,
  syncYearLongPositions,
  validateRanking,
  yearLongCourseIds,
  type RankingModel,
} from "./courseRanking";

const YEAR_LONG = new Set(["A1", "A2"]);

function moveItemTo(order: string[], id: string, target: number): string[] {
  const idx = order.indexOf(id);
  const next = [...order];
  next.splice(idx, 1);
  next.splice(target, 0, id);
  return next;
}

describe("syncYearLongPositions", () => {
  it("places year-long courses at the same indices as the edited column", () => {
    const synced = syncYearLongPositions(
      ["f1", "f2", "A1", "f3"],
      ["s1", "A1", "s2"],
      YEAR_LONG,
    );
    expect(synced.indexOf("A1")).toBe(2);
    expect(synced).toEqual(["s1", "s2", "A1"]);
  });

  it("moves the matching year-long course when the edited column repositions it", () => {
    const synced = syncYearLongPositions(
      ["A1", "f1", "f2", "f3"],
      ["s1", "s2", "A1"],
      YEAR_LONG,
    );
    expect(synced.indexOf("A1")).toBe(0);
    expect(synced).toEqual(["A1", "s1", "s2"]);
  });
});

describe("applyReorder", () => {
  it("reorders freely in the edited column and syncs year-long in the other", () => {
    const model: RankingModel = {
      fallOrder: ["f1", "f2", "A1", "f3"],
      springOrder: ["s1", "s2", "A1"],
    };

    const dragged = moveItemTo(model.fallOrder, "f3", 0);
    const next = applyReorder(model, "fall", dragged, YEAR_LONG);

    expect(next.fallOrder).toEqual(["f3", "f1", "f2", "A1"]);
    expect(next.springOrder.indexOf("A1")).toBe(next.fallOrder.indexOf("A1"));
  });

  it("syncs when a year-long course is dragged in the edited column", () => {
    const model: RankingModel = {
      fallOrder: ["f1", "A1", "f2", "A2"],
      springOrder: ["s1", "A1", "s2", "A2"],
    };

    const dragged = moveItemTo(model.fallOrder, "A2", 0);
    const next = applyReorder(model, "fall", dragged, YEAR_LONG);

    expect(next.fallOrder).toEqual(["A2", "f1", "A1", "f2"]);
    expect(next.springOrder.indexOf("A2")).toBe(0);
    expect(next.springOrder.indexOf("A1")).toBe(2);
  });

  it("moves a regular course past multiple year-long courses", () => {
    const model: RankingModel = {
      fallOrder: ["f1", "A1", "f2", "A2", "f3"],
      springOrder: ["s1", "A1", "A2"],
    };

    const dragged = moveItemTo(model.fallOrder, "f3", 0);
    const next = applyReorder(model, "fall", dragged, YEAR_LONG);

    expect(next.fallOrder[0]).toBe("f3");
    expect(next.springOrder.indexOf("A1")).toBe(next.fallOrder.indexOf("A1"));
    expect(next.springOrder.indexOf("A2")).toBe(next.fallOrder.indexOf("A2"));
  });
});

describe("deriveAlignedRows", () => {
  it("pads the shorter column with spacers so rows line up", () => {
    const rows = deriveAlignedRows({
      fallOrder: ["f1", "f2", "A1", "f3"],
      springOrder: ["s1", "s2", "A1"],
    });

    expect(rows[2].fall).toEqual({ kind: "course", id: "A1" });
    expect(rows[2].spring).toEqual({ kind: "course", id: "A1" });
    expect(rows[3].fall).toEqual({ kind: "course", id: "f3" });
    expect(rows[3].spring).toEqual({ kind: "spacer" });
  });
});

describe("deriveColumns", () => {
  it("returns flat course rows with no placeholders", () => {
    const model: RankingModel = {
      fallOrder: ["f1", "f2", "A1"],
      springOrder: ["s1", "A1"],
    };

    const { fallRows, springRows } = deriveColumns(model);
    expect(courseIds(fallRows)).toEqual(["f1", "f2", "A1"]);
    expect(courseIds(springRows)).toEqual(["s1", "A1"]);
  });
});

describe("yearLongCourseIds", () => {
  it("lists bookmarked all-year courses in column order", () => {
    const bookmarks = new Set([
      "art-foundations",
      "art-portfolio",
      "pa-music-ensemble",
      "pa-acting",
    ]);
    expect(
      yearLongCourseIds(
        bookmarks,
        ["art-foundations", "art-portfolio", "pa-acting"],
        ["pa-acting", "pa-music-ensemble", "art-portfolio"],
        COURSES,
      ),
    ).toEqual(["art-portfolio", "pa-music-ensemble"]);
  });
});

describe("mergeModelWithBookmarks", () => {
  it("preserves order for kept courses and appends new ones", () => {
    const bookmarks = new Set([
      "pa-acting",
      "cs-intro",
      "pa-dance",
      "art-printmaking",
    ]);
    const prev: RankingModel = {
      fallOrder: ["cs-intro", "pa-acting"],
      springOrder: ["pa-dance"],
    };
    const next = mergeModelWithBookmarks(bookmarks, prev, COURSES);

    expect(next.fallOrder).toEqual(["cs-intro", "pa-acting"]);
    expect(next.springOrder).toEqual(["pa-dance", "art-printmaking"]);
  });
});

describe("validateRanking", () => {
  const fallRows = Array.from({ length: 6 }, (_, i) => ({
    kind: "course" as const,
    id: `f${i}`,
  }));
  const springRows = Array.from({ length: 6 }, (_, i) => ({
    kind: "course" as const,
    id: `s${i}`,
  }));

  it("requires the configured number of courses per column", () => {
    expect(validateRanking(fallRows, springRows, 8).valid).toBe(false);
    expect(validateRanking(fallRows, springRows, 6).valid).toBe(true);
    expect(validateRanking(fallRows, springRows, 4).valid).toBe(true);
  });
});

describe("buildInitialModel", () => {
  it("sorts eligible courses alphabetically per column", () => {
    const bookmarks = new Set(["pa-acting", "pa-dance", "art-printmaking"]);
    const model = buildInitialModel(bookmarks, COURSES);
    expect(model.fallOrder).toEqual(["pa-acting"]);
    expect(model.springOrder).toEqual(["pa-dance", "art-printmaking"]);
  });
});
