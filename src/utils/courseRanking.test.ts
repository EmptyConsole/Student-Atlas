import { describe, expect, it } from "vitest";
import {
  applyReorder,
  courseIds,
  deriveColumns,
  type RankingModel,
} from "./courseRanking";

const HEAD = "__head__";

/** Move `id` up by `by` positions in a derived row order, mimicking a drag. */
function moveItemUp(order: string[], id: string, by: number): string[] {
  const idx = order.indexOf(id);
  const target = Math.max(0, idx - by);
  const next = [...order];
  next.splice(idx, 1);
  next.splice(target, 0, id);
  return next;
}

/** Move `id` to an absolute row index, mimicking a drag to a specific slot. */
function moveItemTo(order: string[], id: string, target: number): string[] {
  const idx = order.indexOf(id);
  const next = [...order];
  next.splice(idx, 1);
  next.splice(target, 0, id);
  return next;
}

function rowIds(rows: { id: string }[]): string[] {
  return rows.map((row) => row.id);
}

describe("applyReorder anchor move-up", () => {
  it("moves a Spring anchor up through placeholder rows, pulling Fall courses down", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1", "f2", "f3"], A: [] },
      springGroups: { [HEAD]: ["s1"], A: [] },
    };

    const springOrder = rowIds(deriveColumns(model).springRows);
    const dragged = moveItemUp(springOrder, "A", 2);
    const next = applyReorder(model, "spring", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    expect(rowIds(fallRows).indexOf("A")).toBe(1);
    expect(rowIds(springRows).indexOf("A")).toBe(1);
    expect(next.fallGroups[HEAD]).toEqual(["f1"]);
    expect(next.fallGroups.A).toEqual(["f2", "f3"]);
  });

  it("reorders within a column via regroup without band redistribution on the taller side", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1", "f2", "f3"], A: [] },
      springGroups: { [HEAD]: ["s1"], A: [] },
    };

    const fallOrder = rowIds(deriveColumns(model).fallRows);
    const dragged = moveItemUp(fallOrder, "A", 2);
    const next = applyReorder(model, "fall", dragged);

    const { fallRows } = deriveColumns(next);
    expect(rowIds(fallRows).indexOf("A")).toBe(1);
    expect(next.fallGroups[HEAD]).toEqual(["f1"]);
    expect(next.fallGroups.A).toEqual(["f2", "f3"]);
    // The taller column was not dragged, so its groups are untouched.
    expect(next.springGroups).toEqual(model.springGroups);
  });

  it("stops the anchor at the highest shared row when dragged to the top", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1", "f2", "f3"], A: [] },
      springGroups: { [HEAD]: ["s1"], A: [] },
    };

    const springOrder = rowIds(deriveColumns(model).springRows);
    const dragged = moveItemUp(springOrder, "A", springOrder.length);
    const next = applyReorder(model, "spring", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    // f1 and s1 still sit above the anchor, so the highest shared row is rank 2.
    expect(rowIds(fallRows).indexOf("A")).toBe(1);
    expect(rowIds(springRows).indexOf("A")).toBe(1);
    expect(next.springGroups.A).toEqual(["s1"]);
  });

  it("redistributes within the band above a second anchor (keyed by the first anchor)", () => {
    const model: RankingModel = {
      anchors: ["A1", "A2"],
      fallGroups: { [HEAD]: ["f0"], A1: ["f1", "f2", "f3"], A2: [] },
      springGroups: { [HEAD]: ["s0"], A1: ["s1"], A2: [] },
    };

    const springOrder = rowIds(deriveColumns(model).springRows);
    const dragged = moveItemUp(springOrder, "A2", 2);
    const next = applyReorder(model, "spring", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    expect(rowIds(fallRows).indexOf("A2")).toBe(3);
    expect(rowIds(springRows).indexOf("A2")).toBe(3);
    expect(next.fallGroups.A1).toEqual(["f1"]);
    expect(next.fallGroups.A2).toEqual(["f2", "f3"]);
  });
});

describe("applyReorder anchor move-down", () => {
  it("moves an anchor down through placeholder rows, pulling the taller column's lower courses up", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1"], A: [] },
      springGroups: { [HEAD]: ["s1"], A: ["s2", "s3"] },
    };

    // Fall is shorter below the anchor, so its band renders as two None slots.
    const fallOrder = rowIds(deriveColumns(model).fallRows);
    const dragged = moveItemTo(fallOrder, "A", fallOrder.length - 1);
    const next = applyReorder(model, "fall", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    // The anchor now sits below every course in both columns, on the same row.
    expect(rowIds(fallRows).indexOf("A")).toBe(3);
    expect(rowIds(springRows).indexOf("A")).toBe(3);
    expect(next.springGroups[HEAD]).toEqual(["s1", "s2", "s3"]);
    expect(next.springGroups.A).toEqual([]);
  });

  it("does not redistribute when an anchor is dragged down in the taller column", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1"], A: ["f2", "f3"] },
      springGroups: { [HEAD]: ["s1"], A: [] },
    };

    const fallOrder = rowIds(deriveColumns(model).fallRows);
    const dragged = moveItemTo(fallOrder, "A", fallOrder.length - 1);
    const next = applyReorder(model, "fall", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    expect(rowIds(fallRows).indexOf("A")).toBe(rowIds(springRows).indexOf("A"));
    // The shorter column has no lower courses to pull up, so it is untouched.
    expect(next.springGroups).toEqual(model.springGroups);
  });
});

describe("dragging a None placeholder", () => {
  it("leaves the real course order unchanged in both columns", () => {
    const model: RankingModel = {
      anchors: ["A"],
      fallGroups: { [HEAD]: ["f1", "f2"], A: [] },
      springGroups: { [HEAD]: ["s1"], A: [] },
    };

    // Spring's HEAD band has a trailing None slot since Fall is taller.
    const springOrder = rowIds(deriveColumns(model).springRows);
    const placeholderId = springOrder.find((id) => id.startsWith("ph-"));
    expect(placeholderId).toBeDefined();

    const dragged = moveItemTo(springOrder, placeholderId as string, 0);
    const next = applyReorder(model, "spring", dragged);

    const { fallRows, springRows } = deriveColumns(next);
    expect(courseIds(fallRows)).toEqual(["f1", "f2", "A"]);
    expect(courseIds(springRows)).toEqual(["s1", "A"]);
  });
});
