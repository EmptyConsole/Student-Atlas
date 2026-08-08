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

  describe("displacement pass", () => {
    /**
     * Open to junior + senior so seniority alone decides who is seated first;
     * a short junior can still bump a senior during the displacement pass.
     */
    function openCourse(
      partial: Partial<ElectiveCourse> & Pick<ElectiveCourse, "id" | "title">,
    ): ElectiveCourse {
      return course({ grade: [11, 12], ...partial });
    }

    it("bumps a seated student down one choice to seat a student with none", () => {
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
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [student("senior", 12), student("junior", 11)],
        courses,
        // The senior is seated first and has somewhere lower to go; the junior
        // ranked nothing else, so without a bump they get nothing.
        rankings: [
          rank("senior", "a", 1),
          rank("senior", "b", 2),
          rank("junior", "a", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.a?.[0] ?? "")).toEqual(["junior"]);
      expect(rosterStudents(result.rosters.b?.[0] ?? "")).toEqual(["senior"]);
      expect(result.shortfalls).toEqual([]);
      expect(result.displacements).toHaveLength(1);
      expect(result.displacements[0]).toMatchObject({
        displacedStudentId: "senior",
        beneficiaryStudentId: "junior",
        fromCourseId: "a",
        fromPreferenceRank: 1,
        toCourseId: "b",
        toPreferenceRank: 2,
      });
    });

    it("takes the seat of the occupant furthest down their own ranking", () => {
      const courses = [
        openCourse({
          id: "shared",
          title: "Shared",
          maxStudentCount: 2,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "b",
          title: "B",
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        openCourse({
          id: "c",
          title: "C",
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
        // Capacity 0 pads the second senior's list so `shared` sits at rank 3.
        openCourse({ id: "pad1", title: "Pad 1", maxStudentCount: 0 }),
        openCourse({ id: "pad2", title: "Pad 2", maxStudentCount: 0 }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("top-choice", 12),
          student("last-resort", 12),
          student("junior", 11),
        ],
        courses,
        rankings: [
          rank("top-choice", "shared", 1),
          rank("top-choice", "b", 2),
          rank("last-resort", "pad1", 1),
          rank("last-resort", "pad2", 2),
          rank("last-resort", "shared", 3),
          rank("last-resort", "c", 4),
          rank("junior", "shared", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.shared?.[0] ?? "")).toEqual([
        "top-choice",
        "junior",
      ]);
      expect(rosterStudents(result.rosters.c?.[0] ?? "")).toEqual([
        "last-resort",
      ]);
      expect(result.rosters.b).toBeUndefined();
      expect(result.shortfalls).toEqual([]);
      expect(result.displacements).toHaveLength(1);
      expect(result.displacements[0]).toMatchObject({
        displacedStudentId: "last-resort",
        fromPreferenceRank: 3,
        toPreferenceRank: 4,
      });
    });

    it("leaves alone an occupant already on their last ranked choice", () => {
      const courses = [
        openCourse({
          id: "shared",
          title: "Shared",
          maxStudentCount: 2,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "b",
          title: "B",
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        openCourse({ id: "pad", title: "Pad", maxStudentCount: 0 }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("at-bottom", 12),
          student("has-room", 12),
          student("junior", 11),
        ],
        courses,
        rankings: [
          // `shared` is this senior's final choice, so they cannot slide down
          // even though rank 2 is worse than the other senior's rank 1.
          rank("at-bottom", "pad", 1),
          rank("at-bottom", "shared", 2),
          rank("has-room", "shared", 1),
          rank("has-room", "b", 2),
          rank("junior", "shared", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.shared?.[0] ?? "")).toEqual([
        "at-bottom",
        "junior",
      ]);
      expect(rosterStudents(result.rosters.b?.[0] ?? "")).toEqual(["has-room"]);
      expect(result.displacements).toHaveLength(1);
      expect(result.displacements[0]!.displacedStudentId).toBe("has-room");
    });

    it("keeps the shortfall when the occupant has nowhere lower to go", () => {
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
          maxStudentCount: 0,
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
      // The senior's seat must be intact after the failed attempt.
      expect(rosterStudents(result.rosters.a?.[0] ?? "")).toEqual(["senior"]);
      expect(result.timesTaken.senior).toEqual([[1, 1, 500, 600]]);
      expect(result.timesTaken.junior).toBeUndefined();
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

    it("cascades when the displaced student's next choice is also full", () => {
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
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        openCourse({
          id: "c",
          title: "C",
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
      ];
      // Seed seating: senior-a on A, senior-b on B. Junior wants A.
      // Bumping senior-a requires cascading through B onto C.
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 1, 11: 1 },
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("senior-a", 12),
          student("senior-b", 12),
          student("junior", 11),
        ],
        courses,
        rankings: [
          rank("senior-a", "a", 1),
          rank("senior-a", "b", 2),
          rank("senior-a", "c", 3),
          rank("senior-b", "b", 1),
          rank("senior-b", "c", 2),
          rank("junior", "a", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters.a?.[0] ?? "")).toEqual(["junior"]);
      expect(rosterStudents(result.rosters.b?.[0] ?? "")).toEqual(["senior-a"]);
      expect(rosterStudents(result.rosters.c?.[0] ?? "")).toEqual(["senior-b"]);
      expect(result.shortfalls).toEqual([]);
      // Two hops: senior-b slid for senior-a, then senior-a slid for junior.
      expect(result.displacements).toHaveLength(2);
      expect(result.displacements.map((d) => d.displacedStudentId)).toEqual([
        "senior-b",
        "senior-a",
      ]);
    });

    it("lets younger students displace a given person only once", () => {
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
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        openCourse({
          id: "c",
          title: "C",
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
        openCourse({
          id: "d",
          title: "D",
          maxStudentCount: 10,
          schedule: [{ day: 3, start: 500, end: 600 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 2, 11: 1 },
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("senior", 12),
          student("junior-a", 11),
          student("junior-b", 11),
        ],
        courses,
        // The senior holds both scarce seats; the second junior is younger, so
        // they cannot re-bump after the first junior already did.
        rankings: [
          rank("senior", "a", 1),
          rank("senior", "b", 2),
          rank("senior", "c", 3),
          rank("senior", "d", 4),
          rank("junior-a", "a", 1),
          rank("junior-b", "b", 1),
        ],
      };

      const result = runElectiveSort(input, 3);
      expect(result.displacements).toHaveLength(1);
      expect(result.displacements[0]!.displacedStudentId).toBe("senior");
      expect(result.shortfalls).toHaveLength(1);
      expect(result.shortfalls[0]!.grade).toBe(11);
    });

    it("lets an older or same-grade student re-displace someone already bumped", () => {
      const courses = [
        openCourse({
          id: "b",
          title: "B",
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "c",
          title: "C",
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
        openCourse({
          id: "d",
          title: "D",
          maxStudentCount: 10,
          schedule: [{ day: 2, start: 500, end: 600 }],
        }),
        openCourse({
          id: "e",
          title: "E",
          maxStudentCount: 10,
          schedule: [{ day: 3, start: 500, end: 600 }],
        }),
      ];
      // Two scarce seats, four same-grade students. The winner of B can slide
      // to D then E; the other B/C sitters have no lower choice, so both
      // shortfall students bump that same winner (allowed — same grade).
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        terms: [{ id: T1, rank: 1 }],
        students: [
          student("winner", 12),
          student("sitter", 12),
          student("short-a", 12),
          student("short-b", 12),
        ],
        courses,
        rankings: [
          rank("winner", "b", 1),
          rank("winner", "c", 2),
          rank("winner", "d", 3),
          rank("winner", "e", 4),
          rank("sitter", "c", 1),
          rank("sitter", "b", 2),
          rank("short-a", "b", 1),
          rank("short-a", "c", 2),
          rank("short-b", "b", 1),
          rank("short-b", "c", 2),
        ],
      };

      const result = runElectiveSort(input, 5);
      const winnerBumps = result.displacements.filter(
        (d) => d.displacedStudentId === "winner",
      );
      expect(winnerBumps.length).toBeGreaterThanOrEqual(2);
      expect(result.shortfalls).toEqual([]);
    });

    it("only slides an occupant into a course spanning the same terms", () => {
      const courses = [
        openCourse({
          id: "fall",
          title: "Fall Only",
          termOptions: [T1],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "year",
          title: "Year Long",
          termOptions: [T1, T2],
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 1, 11: 1 },
        terms: TERMS,
        students: [student("senior", 12), student("junior", 11)],
        courses,
        rankings: [
          rank("senior", "fall", 1),
          rank("senior", "year", 2),
          rank("junior", "fall", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      // Moving the senior into the year-long course would hand them a term-2
      // seat they are not owed, so the bump is refused.
      expect(rosterStudents(result.rosters.fall?.[0] ?? "")).toEqual(["senior"]);
      expect(result.rosters.year).toBeUndefined();
      expect(result.displacements).toEqual([]);
    });

    it("slides between year-long courses, keeping every term counted", () => {
      const courses = [
        openCourse({
          id: "year-a",
          title: "Year A",
          termOptions: [T1, T2],
          maxStudentCount: 1,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "year-b",
          title: "Year B",
          termOptions: [T1, T2],
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
      ];
      const input: ElectiveSortInput = {
        electivesAssigned: 1,
        electivesAssignedByGrade: { 12: 1, 11: 1 },
        terms: TERMS,
        students: [student("senior", 12), student("junior", 11)],
        courses,
        rankings: [
          rank("senior", "year-a", 1),
          rank("senior", "year-b", 2),
          rank("junior", "year-a", 1),
        ],
      };

      const result = runElectiveSort(input, 1);
      expect(rosterStudents(result.rosters["year-a"]?.[0] ?? "")).toEqual([
        "junior",
      ]);
      expect(rosterStudents(result.rosters["year-b"]?.[0] ?? "")).toEqual([
        "senior",
      ]);
      expect(result.timesTaken.senior).toEqual([
        [1, 1, 700, 800],
        [2, 1, 700, 800],
      ]);
      expect(result.timesTaken.junior).toEqual([
        [1, 1, 500, 600],
        [2, 1, 500, 600],
      ]);
      expect(result.shortfalls).toEqual([]);
      expect(result.displacements).toHaveLength(1);
    });

    it("is reproducible with the same seed", () => {
      const courses = [
        openCourse({
          id: "shared",
          title: "Shared",
          maxStudentCount: 2,
          schedule: [{ day: 1, start: 500, end: 600 }],
        }),
        openCourse({
          id: "b",
          title: "B",
          maxStudentCount: 10,
          schedule: [{ day: 1, start: 700, end: 800 }],
        }),
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
          student("senior-1", 12),
          student("senior-2", 12),
          student("junior", 11),
        ],
        courses,
        rankings: [
          rank("senior-1", "shared", 1),
          rank("senior-1", "b", 2),
          rank("senior-1", "c", 3),
          rank("senior-2", "shared", 1),
          rank("senior-2", "b", 2),
          rank("senior-2", "c", 3),
          rank("junior", "shared", 1),
        ],
      };

      const a = runElectiveSort(input, 999);
      const b = runElectiveSort(input, 999);
      expect(a.rosters).toEqual(b.rosters);
      expect(a.displacements).toEqual(b.displacements);
    });
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
      // Grade 12 is absent from the map, so the senior is skipped entirely.
      expect(countFor(result, "senior")).toBe(0);
      expect(result.shortfalls).toEqual([]);
    });
  });
});
