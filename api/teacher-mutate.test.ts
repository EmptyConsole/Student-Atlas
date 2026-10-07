import { describe, expect, it } from "vitest";
import { normalizeDomains } from "./teacher-mutate";

describe("normalizeDomains", () => {
  it("lowercases, strips a leading @, and drops blanks and duplicates", () => {
    expect(normalizeDomains([" MySchool.org ", "@myschool.org", "", "students.myschool.org"])).toEqual({
      domains: ["myschool.org", "students.myschool.org"],
    });
  });

  it("allows an empty list, which turns Google sign-in off", () => {
    expect(normalizeDomains([])).toEqual({ domains: [] });
  });

  it("rejects something that is not a domain", () => {
    expect(normalizeDomains(["myschool"])).toEqual({
      error: '"myschool" is not a valid domain.',
    });
    expect(normalizeDomains(["ada@myschool.org"])).toHaveProperty("error");
  });

  it("rejects a non-list and more than 10 domains", () => {
    expect(normalizeDomains("myschool.org")).toHaveProperty("error");
    const many = Array.from({ length: 11 }, (_, i) => `school${i}.org`);
    expect(normalizeDomains(many)).toHaveProperty("error");
  });
});
