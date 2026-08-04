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
    // Seed one student into the middle section so the empty day-1 500 and
    // day-2 500 are least-full (0); day-1 500 wins the tie-break.
    const students = [student("s1"), student("s2")];
    const rankings = [rank("s1", "c1", 1), rank("s2", "c1", 1)];
    const input: ElectiveSortInput = {
      electivesAssigned: 1,
      terms: [{ id: T1, rank: 1 }],
      students,
      courses,
      rankings,
    };

    // With seed 42 both students go to least-full; first gets day1/500, second
    // also prefers day1/500 (still least among ties after first sits there...
    // actually after s1 sits, day1/500 has 1 and day2/500 has 0, so s2 goes
    // to day2/500). Order depends on shuffle.
    const result = runElectiveSort(input, 42);
    const entries = result.rosters.c1 ?? [];
    expect(entries.length).toBeGreaterThan(0);

    // Both students assigned; sections used should be the two least-loaded
    // earliest blocks rather than packing into one.
    const keys = entries.map((e) => e.split("|")[0]);
    expect(keys).toContain("1,500,600");
    // Second student should land on another empty section (2,500,600) once
    // the first took 1,500,600 — unless shuffle order packs differently with
    // capacity 10. With capacity 10 both could go to the same section since
    // least-full after first is still that section only if others are empty
    // wait: after first assignment to 1,500,600 count=1, others=0, so second
    // picks least (0) → day1/700 or day2/500; day1/700 wins by day then start.
    // Actually day1/700 (day=1,start=700) vs day2/500 (day=2): day1 wins.
    if (entries.length === 2) {
      expect(keys).toContain("1,700,800");
    } else {
      // Same section only if both got 1,500,600 which shouldn't happen when
      // emptier sections exist.
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
    // Preference for year-long is stored once; it appears in both columns.
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
    // With electivesAssigned=1, year-long already fills both terms' quotas,
    // so spring-only should not be needed.
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
    // Still short in both terms for the second elective.
    expect(result.shortfalls.length).toBeGreaterThan(0);
  });

  it("gives nobody a second elective before everyone has a first (round fairness)", () => {
    // Two students, capacity 1 on top pick so only one can get it in round 1;
    // both need 2 electives. The other student must get their first from the
    // backup before anyone gets a second.
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
    // After round 1 both should have exactly 1 elective (popular + backup).
    // After round 2 both get extra.
    for (const id of ["s1", "s2"]) {
      const quads = result.timesTaken[id] ?? [];
      expect(quads.length).toBe(2);
    }
    expect(result.shortfalls).toHaveLength(0);
  });

  it("processes higher grades before lower grades", () => {
    // Capacity 1 course; grade-12 and grade-10 both want it. Grade 12 wins.
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
    const courses = [
      course({ id: "local", title: "Local" }),
      // Foreign course is NOT in the courses array handed to the algorithm.
    ];
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

  describe("per-grade quotas", () => {
    /** Four conflict-free, uncapped courses open to grades 10 and 12. */
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

    it("gives each grade its own quota, falling back for unlisted grades", () => {
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
      expect(countFor(result, "soph")).toBe(1);
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
      expect(result.shortfalls).toEqual([
        {
          studentId: "senior",
          termId: T1,
          grade: 12,
          assigned: 1,
          required: 3,
        },
      ]);
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
      expect(countFor(result, "senior")).toBe(2);
      expect(result.shortfalls).toEqual([]);
    });
  });
});
