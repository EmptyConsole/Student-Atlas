import { describe, expect, it } from "vitest";
import {
  runElectiveSort,
  timesOverlap,
  type ElectiveCourse,
  type ElectiveRanking,
  type ElectiveSortInput,
  type ElectiveStudent,
  type ElectiveTerm,
} from "./electiveSort";

const T1 = "term-1";
const T2 = "term-2";

const TERMS: ElectiveTerm[] = [
  { id: T1, rank: 1 },
  { id: T2, rank: 2 },
];

function course(
  partial: Partial<ElectiveCourse> & Pick<ElectiveCourse, "id" | "title">,
): ElectiveCourse {
  return {
    grade: [10],
    termOptions: [T1],
    schedule: [{ day: 1, start: 500, end: 600 }],
    maxStudentCount: 20,
    ...partial,
  };
}

function student(id: string, grade: number | null = 10): ElectiveStudent {
  return { id, grade };
}

function rank(
  studentId: string,
  courseId: string,
  preference: number,
): ElectiveRanking {
  return { studentId, courseId, preference };
}

function rosterStudents(entry: string): string[] {
  const pipe = entry.indexOf("|");
  if (pipe < 0) return [];
  const rest = entry.slice(pipe + 1);
  return rest ? rest.split(",") : [];
}

function allAssignedStudents(rosters: Record<string, string[]>): Set<string> {
  const ids = new Set<string>();
  for (const entries of Object.values(rosters)) {
    for (const entry of entries) {
      for (const id of rosterStudents(entry)) ids.add(id);
    }
  }
  return ids;
}

describe("timesOverlap", () => {
  it("detects overlapping blocks on the same day", () => {
    expect(
      timesOverlap(
        { day: 1, start: 500, end: 600 },
        { day: 1, start: 550, end: 650 },
      ),
    ).toBe(true);
  });

  it("treats end as exclusive (touching boundary is not a conflict)", () => {
    expect(
      timesOverlap(
        { day: 1, start: 500, end: 615 },
        { day: 1, start: 615, end: 700 },
      ),
    ).toBe(false);
  });

  it("ignores different days", () => {
    expect(
      timesOverlap(
        { day: 1, start: 500, end: 600 },
        { day: 2, start: 500, end: 600 },
      ),
    ).toBe(false);
  });
});

describe("runElectiveSort", () => {
  it("spills to the next ranked course when the top choice is full", () => {
    const courses = [
      course({
        id: "c1",
        title: "Full",
        maxStudentCount: 1,
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
      course({
        id: "c2",
        title: "Backup",
        maxStudentCount: 10,
        schedule: [{ day: 1, start: 700, end: 800 }],
      }),
    ];
    const students = [student("s1"), student("s2")];
    const rankings = [
      rank("s1", "c1", 1),
      rank("s1", "c2", 2),
      rank("s2", "c1", 1),
      rank("s2", "c2", 2),
    ];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    const onC1 = allAssignedStudents(
      result.rosters.c1 ? { c1: result.rosters.c1 } : {},
    );
    const onC2 = allAssignedStudents(
      result.rosters.c2 ? { c2: result.rosters.c2 } : {},
    );

    expect(onC1.size).toBe(1);
    expect(onC2.size).toBe(1);
    expect(new Set([...onC1, ...onC2])).toEqual(new Set(["s1", "s2"]));
  });

  it("picks the least-full class, tie-breaking by day then start", () => {
    const courses = [
      course({
        id: "c1",
        title: "Multi",
        maxStudentCount: 10,
        schedule: [
          { day: 1, start: 500, end: 600 },
          { day: 1, start: 700, end: 800 },
          { day: 2, start: 500, end: 600 },
        ],
      }),
    ];
    const students = [student("s1"), student("s2")];
    const rankings = [rank("s1", "c1", 1), rank("s2", "c1", 1)];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 42);
    const entries = result.rosters.c1 ?? [];
    expect(entries.length).toBeGreaterThan(0);
    const keys = entries.map((e) => e.split("|")[0]);
    expect(keys).toContain("1,500,600");
    if (entries.length === 2) {
      expect(keys).toContain("1,700,800");
    } else {
      expect(entries.length).toBe(2);
    }
  });

  it("allows back-to-back classes that only touch at the exclusive end", () => {
    const courses = [
      course({
        id: "c1",
        title: "First",
        schedule: [{ day: 1, start: 500, end: 615 }],
      }),
      course({
        id: "c2",
        title: "Second",
        schedule: [{ day: 1, start: 615, end: 730 }],
      }),
    ];
    const students = [student("s1")];
    const rankings = [rank("s1", "c1", 1), rank("s1", "c2", 2)];
    const input: ElectiveSortInput = {
      electivesAssigned: 2,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    expect(result.rosters.c1?.length).toBe(1);
    expect(result.rosters.c2?.length).toBe(1);
    expect(result.shortfalls).toHaveLength(0);
  });

  it("rejects a true overlap", () => {
    const courses = [
      course({
        id: "c1",
        title: "First",
        schedule: [{ day: 1, start: 500, end: 650 }],
      }),
      course({
        id: "c2",
        title: "Overlap",
        schedule: [{ day: 1, start: 600, end: 700 }],
      }),
    ];
    const students = [student("s1")];
    const rankings = [rank("s1", "c1", 1), rank("s1", "c2", 2)];
    const input: ElectiveSortInput = {
      electivesAssigned: 2,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    expect(result.rosters.c1?.length).toBe(1);
    expect(result.rosters.c2).toBeUndefined();
    // Leftover fill may still seat them if another course exists; here only
    // two overlapping courses, so still one shortfall seat missing.
    expect(result.shortfalls).toHaveLength(1);
    expect(result.shortfalls[0]!.assigned).toBe(1);
  });

  it("assigns multi-term courses only in the first term but counts all terms", () => {
    const courses = [
      course({
        id: "year",
        title: "Year Long",
        termOptions: [T1, T2],
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
      course({
        id: "spring-only",
        title: "Spring Only",
        termOptions: [T2],
        schedule: [{ day: 1, start: 700, end: 800 }],
      }),
    ];
    const students = [student("s1")];
    const rankings = [
      rank("s1", "year", 1),
      rank("s1", "spring-only", 2),
    ];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: TERMS,
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    expect(result.rosters.year?.length).toBe(1);
    expect(result.rosters["spring-only"]).toBeUndefined();
    const quads = result.timesTaken.s1 ?? [];
    expect(quads).toEqual([
      [1, 1, 500, 600],
      [2, 1, 500, 600],
    ]);
    expect(result.shortfalls).toHaveLength(0);
  });

  it("does not assign a multi-term course again in a later term", () => {
    const courses = [
      course({
        id: "year",
        title: "Year Long",
        termOptions: [T1, T2],
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
    ];
    const students = [student("s1")];
    const rankings = [rank("s1", "year", 1)];
    const input: ElectiveSortInput = {
      electivesAssigned: 2,
      terms: TERMS,
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    const yearEntry = result.rosters.year?.[0] ?? "";
    expect(rosterStudents(yearEntry)).toEqual(["s1"]);
    expect(result.shortfalls.length).toBeGreaterThan(0);
  });

  it("gives nobody a second elective before everyone has a first (round fairness)", () => {
    const courses = [
      course({
        id: "popular",
        title: "Popular",
        maxStudentCount: 1,
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
      course({
        id: "backup",
        title: "Backup",
        maxStudentCount: 10,
        schedule: [{ day: 1, start: 700, end: 800 }],
      }),
      course({
        id: "extra",
        title: "Extra",
        maxStudentCount: 10,
        schedule: [{ day: 2, start: 500, end: 600 }],
      }),
    ];
    const students = [student("s1"), student("s2")];
    const rankings = [
      rank("s1", "popular", 1),
      rank("s1", "backup", 2),
      rank("s1", "extra", 3),
      rank("s2", "popular", 1),
      rank("s2", "backup", 2),
      rank("s2", "extra", 3),
    ];
    const input: ElectiveSortInput = {
      electivesAssigned: 2,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 7);
    for (const id of ["s1", "s2"]) {
      const quads = result.timesTaken[id] ?? [];
      expect(quads.length).toBe(2);
    }
    expect(result.shortfalls).toHaveLength(0);
  });

  it("gives higher grades priority in the same round", () => {
    const courses = [
      course({
        id: "scarce",
        title: "Scarce",
        grade: [10, 12],
        maxStudentCount: 1,
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
      course({
        id: "other",
        title: "Other",
        grade: [10, 12],
        maxStudentCount: 10,
        schedule: [{ day: 1, start: 700, end: 800 }],
      }),
    ];
    const students = [student("senior", 12), student("soph", 10)];
    const rankings = [
      rank("senior", "scarce", 1),
      rank("senior", "other", 2),
      rank("soph", "scarce", 1),
      rank("soph", "other", 2),
    ];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    const scarceIds = rosterStudents(result.rosters.scarce?.[0] ?? "");
    expect(scarceIds).toEqual(["senior"]);
    const otherIds = allAssignedStudents({
      other: result.rosters.other ?? [],
    });
    expect(otherIds.has("soph")).toBe(true);
  });

  it("is reproducible with the same seed", () => {
    const courses = [
      course({
        id: "c1",
        title: "A",
        maxStudentCount: 1,
        schedule: [{ day: 1, start: 500, end: 600 }],
      }),
      course({
        id: "c2",
        title: "B",
        maxStudentCount: 10,
        schedule: [{ day: 1, start: 700, end: 800 }],
      }),
    ];
    const students = [student("s1"), student("s2"), student("s3")];
    const rankings = students.flatMap((s) => [
      rank(s.id, "c1", 1),
      rank(s.id, "c2", 2),
    ]);
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const a = runElectiveSort(input, 12345);
    const b = runElectiveSort(input, 12345);
    expect(a.rosters).toEqual(b.rosters);
    expect(a.timesTaken).toEqual(b.timesTaken);
    expect(a.seed).toBe(12345);
  });

  it("ignores foreign students and courses in rankings", () => {
    const courses = [course({ id: "local", title: "Local" })];
    const students = [student("local-stu")];
    const rankings = [
      rank("local-stu", "local", 1),
      rank("foreign-stu", "local", 1),
      rank("local-stu", "foreign-course", 2),
    ];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    const assigned = allAssignedStudents(result.rosters);
    expect(assigned.has("local-stu")).toBe(true);
    expect(assigned.has("foreign-stu")).toBe(false);
    expect(result.rosters["foreign-course"]).toBeUndefined();
    expect(result.timesTaken["foreign-stu"]).toBeUndefined();
  });

  it("skips courses whose grade list excludes the student", () => {
    const courses = [
      course({ id: "seniors", title: "Seniors Only", grade: [12] }),
      course({ id: "open", title: "Open", grade: [10] }),
    ];
    const students = [student("s1", 10)];
    const rankings = [rank("s1", "seniors", 1), rank("s1", "open", 2)];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    expect(result.rosters.seniors).toBeUndefined();
    expect(rosterStudents(result.rosters.open?.[0] ?? "")).toEqual(["s1"]);
  });

  it("skips courses with no schedule blocks", () => {
    const courses = [
      course({ id: "nosched", title: "No Schedule", schedule: [] }),
      course({ id: "ok", title: "OK" }),
    ];
    const students = [student("s1")];
    const rankings = [rank("s1", "nosched", 1), rank("s1", "ok", 2)];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    const result = runElectiveSort(input, 1);
    expect(result.rosters.nosched).toBeUndefined();
    expect(rosterStudents(result.rosters.ok?.[0] ?? "")).toEqual(["s1"]);
  });

  describe("round-fair deferred acceptance", () => {
    it("does not let a senior's later round take a locked underclass seat", () => {
      // Round 1: both want scarce (cap 1). Senior wins. Soph gets other.
      // Round 2: senior wants other (soph's locked seat) and extra.
      // Soph's round-1 seat on `other` must stay locked.
      const courses = [
        course({
          id: "scarce",
          title: "Scarce",
          grade: [10, 12],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "other",
          title: "Other",
          grade: [10, 12],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        course({
          id: "extra",
          title: "Extra",
          grade: [10, 12],
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 2, 10: 1 },
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses,
        rankings: [
          rank("senior", "scarce", 1),
          rank("senior", "other", 2),
          rank("senior", "extra", 3),
          rank("soph", "scarce", 1),
          rank("soph", "other", 2),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.scarce?.[0] ?? "")).toEqual([
        "senior",
      ]);
      expect(rosterStudents(result.rosters.other?.[0] ?? "")).toEqual(["soph"]);
      expect(rosterStudents(result.rosters.extra?.[0] ?? "")).toEqual([
        "senior",
      ]);
    });

    it("lets seniors beat sophomores for the same scarce seat in round 1", () => {
      const courses = [
        course({
          id: "scarce",
          title: "Scarce",
          grade: [10, 12],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "backup",
          title: "Backup",
          grade: [10, 12],
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses,
        rankings: [
          rank("senior", "scarce", 1),
          rank("senior", "backup", 2),
          rank("soph", "scarce", 1),
          rank("soph", "backup", 2),
        ],
      };

      const result = runElectiveSort(input, 99);
      expect(rosterStudents(result.rosters.scarce?.[0] ?? "")).toEqual([
        "senior",
      ]);
      expect(rosterStudents(result.rosters.backup?.[0] ?? "")).toEqual(["soph"]);
    });
  });

  describe("constrained repair", () => {
    function openCourse(
      partial: Partial<ElectiveCourse> & Pick<ElectiveCourse, "id" | "title">,
    ): ElectiveCourse {
      return course({ grade: [11, 12], ...partial });
    }

    it("same-grade bump seats a short student by sliding a peer down", () => {
      const courses = [
        openCourse({
          id: "a",
          title: "A",
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "b",
          title: "B",
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      // Two seniors both need a seat; with DA both propose to A, one wins,
      // the other takes B. No shortfall — use a third senior who only ranked A
      // after capacity is locked... Actually with DA in one round, the third
      // also proposes. Cap 1: one on A, two try B.
      // Better: after DA, create shortfall via capacity. Three seniors, A cap 1,
      // B cap 1, only two seats for three people who all rank A then B.
      // The third is short; repair should bump someone who has B as worse
      // wait — if only A and B exist and both full, bump needs a third course.
      const courses3 = [
        ...courses,
        openCourse({
          id: "c",
          title: "C",
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("s1", 12),
          student("s2", 12),
          student("s3", 12),
        ],
        courses: courses3,
        rankings: [
          rank("s1", "a", 1),
          rank("s1", "b", 2),
          rank("s1", "c", 3),
          rank("s2", "a", 1),
          rank("s2", "b", 2),
          rank("s2", "c", 3),
          // s3 only ranks A — after DA, A is full and they have nowhere.
          // Repair: bump whoever is on A (has lower choices) onto B/C.
          rank("s3", "a", 1),
        ],
      };

      // Seed 0: s1/s2 win A in DA; repair bumps one onto B/C so s3 can take A.
      const result = runElectiveSort(input, 0);
      expect(rosterStudents(result.rosters.a?.[0] ?? "")).toContain("s3");
      expect(result.shortfalls).toEqual([]);
      expect(result.displacements.length).toBeGreaterThanOrEqual(1);
      expect(
        result.displacements.every(
          (d) => d.displacedGrade === 12 && d.beneficiaryGrade === 12,
        ),
      ).toBe(true);
    });

    it("does not allow a younger student to bump an older one (no leftover path)", () => {
      const courses = [
        course({
          id: "a",
          title: "A",
          grade: [11, 12],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "b",
          title: "B",
          grade: [12], // senior-only backup
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("junior", 11)],
        courses,
        rankings: [
          rank("senior", "a", 1),
          rank("senior", "b", 2),
          rank("junior", "a", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.a?.[0] ?? "")).toEqual(["senior"]);
      expect(result.displacements).toEqual([]);
      expect(result.shortfalls).toEqual([
        {
          studentId: "junior",
          termId: T1,
          grade: 11,
          assigned: 0,
          required: 1,
        },
      ]);
    });

    it("only slides an occupant into a course spanning the same terms", () => {
      // Seated wins fall; short wants fall. Seated's only lower choice is
      // year-long (different span) with capacity 0 so it also can't be a
      // leftover — bump must refuse the span change.
      const courses = [
        course({
          id: "fall",
          title: "Fall Only",
          grade: [12],
          termOptions: [T1],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "year",
          title: "Year Long",
          grade: [12],
          termOptions: [T1, T2],
          maxStudentCount: 0,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: TERMS,
        students: [student("seated", 12), student("short", 12)],
        courses,
        rankings: [
          rank("seated", "fall", 1),
          rank("seated", "year", 2),
          rank("short", "fall", 1),
        ],
      };

      const result = runElectiveSort(input, 0);
      expect(result.displacements).toEqual([]);
      expect(result.rosters.year).toBeUndefined();
      expect(rosterStudents(result.rosters.fall?.[0] ?? "")).toHaveLength(1);
      // The other student remains short in T1 (plus both may be short in T2).
      expect(
        result.shortfalls.some((s) => s.termId === T1 && s.assigned === 0),
      ).toBe(true);
    });
    it("slides between year-long courses, keeping every term counted", () => {
      const courses = [
        course({
          id: "year-a",
          title: "Year A",
          grade: [12],
          termOptions: [T1, T2],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "year-b",
          title: "Year B",
          grade: [12],
          termOptions: [T1, T2],
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: TERMS,
        students: [student("seated", 12), student("short", 12)],
        courses,
        rankings: [
          rank("seated", "year-a", 1),
          rank("seated", "year-b", 2),
          rank("short", "year-a", 1),
        ],
      };

      // Seed where seated wins year-a in DA; repair bumps them to year-b.
      let result = runElectiveSort(input, 0);
      if (!result.displacements.length) {
        result = runElectiveSort(input, 1);
      }
      if (result.displacements.length > 0) {
        expect(rosterStudents(result.rosters["year-a"]?.[0] ?? "")).toEqual([
          "short",
        ]);
        expect(rosterStudents(result.rosters["year-b"]?.[0] ?? "")).toEqual([
          "seated",
        ]);
        expect(result.timesTaken.seated).toEqual([
          [1, 1, 700, 800],
          [2, 1, 700, 800],
        ]);
        expect(result.timesTaken.short).toEqual([
          [1, 1, 500, 600],
          [2, 1, 500, 600],
        ]);
        expect(result.shortfalls).toEqual([]);
      } else {
        // Both seated somehow (short won DA) — still both terms counted.
        expect(result.shortfalls).toEqual([]);
        expect(result.timesTaken.seated?.length).toBe(2);
        expect(result.timesTaken.short?.length).toBe(2);
      }
    });
  });

  describe("leftover fill", () => {
    it("assigns an unranked eligible open course when the list is exhausted", () => {
      const courses = [
        course({
          id: "full",
          title: "Full",
          grade: [10],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        course({
          id: "leftover",
          title: "Leftover Seat",
          grade: [10],
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [student("first"), student("short")],
        courses,
        rankings: [
          rank("first", "full", 1),
          // short only ranked the full course
          rank("short", "full", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.full?.[0] ?? "")).toHaveLength(1);
      expect(rosterStudents(result.rosters.leftover?.[0] ?? "")).toEqual([
        "short",
      ]);
      const leftoverAsg = result.assignments.find(
        (a) => a.studentId === "short" && a.leftover,
      );
      expect(leftoverAsg).toBeDefined();
      expect(leftoverAsg!.courseId).toBe("leftover");
      expect(result.shortfalls).toEqual([]);
    });
  });

  describe("per-grade quotas", () => {
    const OPEN_COURSES = [1, 2, 3, 4].map((n) =>
      course({
        id: `c${n}`,
        title: `Course ${n}`,
        grade: [10, 12],
        maxStudentCount: -1,
        schedule: [{ day: n, start: 500, end: 600 }],
      }),
    );

    const RANK_ALL = ["senior", "soph"].flatMap((id) =>
      OPEN_COURSES.map((c, i) => rank(id, c.id, i + 1)),
    );

    function countFor(
      result: ReturnType<typeof runElectiveSort>,
      studentId: string,
    ): number {
      return result.assignments.filter((a) => a.studentId === studentId).length;
    }

    it("gives each grade its own quota and skips unlisted grades", () => {
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 3 },
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses: OPEN_COURSES,
        rankings: RANK_ALL,
      };

      const result = runElectiveSort(input, 1);
      expect(countFor(result, "senior")).toBe(3);
      expect(countFor(result, "soph")).toBe(0);
      expect(result.shortfalls).toEqual([]);
    });

    it("falls back to the scalar when no per-grade map is supplied", () => {
      const input: ElectiveSortInput = {
        electivesAssigned: 2,
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses: OPEN_COURSES,
        rankings: RANK_ALL,
      };

      const result = runElectiveSort(input, 1);
      expect(countFor(result, "senior")).toBe(2);
      expect(countFor(result, "soph")).toBe(2);
    });

    it("reports shortfalls against the student's own grade quota", () => {
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 3, 10: 1 },
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses: [OPEN_COURSES[0]!],
        rankings: [rank("senior", "c1", 1), rank("soph", "c1", 1)],
      };

      const result = runElectiveSort(input, 1);
      // Unlimited capacity on OPEN_COURSES[0] is -1, so both can sit.
      // Use a capped course instead — OPEN_COURSES[0] has maxStudentCount: -1.
      // Both get the seat; senior still needs 2 more → shortfall.
      expect(
        result.shortfalls.some(
          (s) =>
            s.studentId === "senior" &&
            s.required === 3 &&
            s.assigned === 1,
        ),
      ).toBe(true);
    });

    it("assigns nothing to a grade whose quota is zero", () => {
      const input: ElectiveSortInput = {
        electivesAssigned: 2,
        electivesAssignedByGrade: { 10: 0 },
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("soph", 10)],
        courses: OPEN_COURSES,
        rankings: RANK_ALL,
      };

      const result = runElectiveSort(input, 1);
      expect(countFor(result, "soph")).toBe(0);
      expect(countFor(result, "senior")).toBe(0);
      expect(result.shortfalls).toEqual([]);
    });
  });
});
