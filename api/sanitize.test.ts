import { describe, expect, it } from "vitest";
import {
  isValidEmail,
  longText,
  MAX_NAME_LENGTH,
  normalizeDomains,
  normalizeEmail,
  sanitizeClassTime,
  sanitizeGradeSettings,
  sanitizeGrades,
  sanitizeMaxStudents,
  sanitizeRankings,
  sanitizeReqOptions,
  sanitizeWebsite,
  text,
} from "./sanitize";

describe("text", () => {
  it("trims, collapses whitespace, and drops control characters", () => {
    expect(text("  Ada\u0000  Lovelace \n")).toBe("Ada Lovelace");
  });

  it("caps length", () => {
    expect(text("x".repeat(MAX_NAME_LENGTH + 20))).toHaveLength(MAX_NAME_LENGTH);
  });

  it("returns empty for non-strings", () => {
    expect(text(12)).toBe("");
    expect(text(null)).toBe("");
  });
});

describe("longText", () => {
  it("keeps newlines and strips other controls", () => {
    expect(longText("line 1\nline\u00002\r\nline 3", 100)).toBe("line 1\nline2\nline 3");
  });
});

describe("sanitizeWebsite", () => {
  it("allows empty, bare hosts, and http(s) URLs", () => {
    expect(sanitizeWebsite("")).toEqual({ website: "" });
    expect(sanitizeWebsite("  riverside.edu ")).toEqual({ website: "riverside.edu" });
    expect(sanitizeWebsite("https://riverside.edu/path")).toEqual({
      website: "https://riverside.edu/path",
    });
  });

  it("rejects javascript: and other non-http schemes", () => {
    expect(sanitizeWebsite("javascript:alert(1)")).toHaveProperty("error");
    expect(sanitizeWebsite("data:text/html,hi")).toHaveProperty("error");
  });
});

describe("sanitizeGradeSettings", () => {
  it("keeps only 0–12 grades with finite counts", () => {
    expect(
      sanitizeGradeSettings({
        "9": { rankings: "8", assigned: "2" },
        "99": { rankings: "8", assigned: "2" },
        abc: { rankings: "8", assigned: "2" },
        "10": { rankings: "oops", assigned: "nope" },
        "11": { rankings: 100, assigned: -1 },
      }),
    ).toEqual({
      "9": { rankings: "8", assigned: "2" },
      "11": { rankings: "50", assigned: "0" },
    });
  });

  it("returns empty for junk", () => {
    expect(sanitizeGradeSettings(null)).toEqual({});
    expect(sanitizeGradeSettings(["nope"])).toEqual({});
  });
});

describe("sanitizeGrades / rankings / max students", () => {
  it("keeps unique grades in 0–12", () => {
    expect(sanitizeGrades([9, 9, 13, "10", 11, -1])).toEqual([9, 11]);
  });

  it("clamps school-wide rankings", () => {
    expect(sanitizeRankings(8)).toBe(8);
    expect(sanitizeRankings(999)).toBe(50);
    expect(sanitizeRankings(-3)).toBe(0);
    expect(sanitizeRankings(undefined)).toBe(8);
  });

  it("treats a missing or negative max as unknown", () => {
    expect(sanitizeMaxStudents(-1)).toBe(-1);
    expect(sanitizeMaxStudents(24)).toBe(24);
    expect(sanitizeMaxStudents(99_999)).toBe(32_767);
  });
});

describe("sanitizeClassTime", () => {
  it("accepts a valid block and rejects inverted or out-of-range ones", () => {
    expect(sanitizeClassTime({ day: 1, start: 480, end: 560 })).toEqual({
      day: 1,
      start: 480,
      end: 560,
    });
    expect(sanitizeClassTime({ day: 1, start: 560, end: 480 })).toBeNull();
    expect(sanitizeClassTime({ day: 99, start: 0, end: 60 })).toBeNull();
    expect(sanitizeClassTime({ day: 1, start: 0, end: 2000 })).toBeNull();
  });
});

describe("sanitizeReqOptions", () => {
  it("keeps UUID items and trims free text, dropping empties", () => {
    const id = "c0000000-0000-4000-a000-000000000001";
    expect(
      sanitizeReqOptions([
        [id, "  Algebra 1  ", "", "\u0000"],
        [],
        "not-a-group",
        ["  "],
      ]),
    ).toEqual([[id, "Algebra 1"]]);
  });
});

describe("email", () => {
  it("normalizes and validates", () => {
    expect(normalizeEmail("  ADA@Example.COM ")).toBe("ada@example.com");
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("*@example.com")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
  });
});

describe("normalizeDomains", () => {
  it("lowercases, strips a leading @, and drops blanks and duplicates", () => {
    expect(normalizeDomains([" MySchool.org ", "@myschool.org", "", "students.myschool.org"])).toEqual({
      domains: ["myschool.org", "students.myschool.org"],
    });
  });

  it("rejects something that is not a domain", () => {
    expect(normalizeDomains(["myschool"])).toEqual({
      error: '"myschool" is not a valid domain.',
    });
  });
});
