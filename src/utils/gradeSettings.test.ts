import { describe, expect, it } from "vitest";
import {
  assignedByGrade,
  assignedForGrade,
  gradesFromSettings,
  parseGradeSettings,
  rankingsForGrade,
  serializeGradeSettings,
  type GradeSettings,
} from "./gradeSettings";

const STORED = {
  "9": { assigned: "2", rankings: "8" },
  "10": { assigned: "2", rankings: "8" },
  "11": { assigned: "3", rankings: "9" },
  "12": { assigned: "6", rankings: "12" },
};

describe("parseGradeSettings", () => {
  it("coerces string counts into numbers", () => {
    const settings = parseGradeSettings(STORED);
    expect(settings.get(11)).toEqual({ rankings: 9, assigned: 3 });
    expect(settings.get(12)).toEqual({ rankings: 12, assigned: 6 });
  });

  it("accepts numeric counts too", () => {
    const settings = parseGradeSettings({ "9": { rankings: 5, assigned: 1 } });
    expect(settings.get(9)).toEqual({ rankings: 5, assigned: 1 });
  });

  it("returns an empty lookup for null, arrays, and primitives", () => {
    expect(parseGradeSettings(null).size).toBe(0);
    expect(parseGradeSettings(undefined).size).toBe(0);
    expect(parseGradeSettings([1, 2, 3]).size).toBe(0);
    expect(parseGradeSettings("nope").size).toBe(0);
  });

  it("skips malformed grades and entries", () => {
    const settings = parseGradeSettings({
      abc: { rankings: "8", assigned: "2" },
      "-1": { rankings: "8", assigned: "2" },
      "9": null,
      "10": { rankings: "oops", assigned: "nope" },
      "11": { rankings: "9", assigned: "3" },
    });
    expect([...settings.keys()]).toEqual([11]);
  });

  it("defaults a missing half of the pair to zero", () => {
    const settings = parseGradeSettings({ "9": { rankings: "8" } });
    expect(settings.get(9)).toEqual({ rankings: 8, assigned: 0 });
  });
});

describe("serializeGradeSettings", () => {
  it("round-trips the stored shape in grade order", () => {
    const json = serializeGradeSettings(parseGradeSettings(STORED));
    expect(Object.keys(json)).toEqual(["9", "10", "11", "12"]);
    expect(json["12"]).toEqual({ rankings: "12", assigned: "6" });
  });
});

describe("grade lookups", () => {
  const settings: GradeSettings = parseGradeSettings(STORED);

  it("reads the grade's own counts", () => {
    expect(rankingsForGrade(settings, 11, 8)).toBe(9);
    expect(assignedForGrade(settings, 12, 0)).toBe(6);
  });

  it("falls back for an unlisted grade", () => {
    expect(rankingsForGrade(settings, 8, 8)).toBe(8);
    expect(assignedForGrade(settings, 8, 2)).toBe(2);
  });

  it("falls back when the student has no grade", () => {
    expect(rankingsForGrade(settings, null, 8)).toBe(8);
    expect(assignedForGrade(settings, null, 2)).toBe(2);
  });

  it("falls back when rankings is zero, but honors an explicit zero assigned", () => {
    const zeroed = parseGradeSettings({ "9": { rankings: "0", assigned: "0" } });
    expect(rankingsForGrade(zeroed, 9, 8)).toBe(8);
    expect(assignedForGrade(zeroed, 9, 2)).toBe(0);
  });
});

describe("assignedByGrade", () => {
  it("flattens assigned counts into a plain record", () => {
    expect(assignedByGrade(parseGradeSettings(STORED))).toEqual({
      9: 2,
      10: 2,
      11: 3,
      12: 6,
    });
  });
});

describe("gradesFromSettings", () => {
  it("returns configured grades in ascending order", () => {
    expect(gradesFromSettings(parseGradeSettings(STORED))).toEqual([
      9, 10, 11, 12,
    ]);
  });

  it("returns an empty list when nothing is configured", () => {
    expect(gradesFromSettings(parseGradeSettings(null))).toEqual([]);
  });
});
