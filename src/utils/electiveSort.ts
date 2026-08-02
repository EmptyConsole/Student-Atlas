/**
 * Pure elective-assignment algorithm.
 *
 * No I/O. Given school-scoped students, courses, rankings, and terms, assigns
 * students to class sections following grade → term → round order. See the
 * plan for full semantics.
 */

import { classTimeKey, type ClassTime } from "./classTime";

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

export type ElectiveStudent = {
  id: string;
  grade: number | null;
};

export type ElectiveCourse = {
  id: string;
  title: string;
  /** Eligible grades; empty/null means no one. */
  grade: number[] | null;
  /** Term UUIDs this offering covers. */
  termOptions: string[];
  /** Class sections: [day, start, end] triples. */
  schedule: ClassTime[];
  /** Per-class capacity. -1 = unlimited. */
  maxStudentCount: number;
};

export type ElectiveRanking = {
  studentId: string;
  courseId: string;
  preference: number | null;
};

export type ElectiveTerm = {
  id: string;
  /** 1-based display rank (position ASC NULLS LAST, created_at ASC). */
  rank: number;
  /** Display name when available (reporting only; unused by the algorithm). */
  name?: string;
};

export type ElectiveSortInput = {
  electivesAssigned: number;
  terms: ElectiveTerm[];
  students: ElectiveStudent[];
  courses: ElectiveCourse[];
  rankings: ElectiveRanking[];
};

/** Roster entry matching the DB encoding `'day,start,end|uuid1,uuid2,...'`. */
export type RosterEntry = string;

export type ElectiveShortfall = {
  studentId: string;
  termId: string;
  grade: number | null;
  assigned: number;
  required: number;
};

export type ClassFill = {
  courseId: string;
  day: number;
  start: number;
  end: number;
  count: number;
  capacity: number;
};

/** One successful seat assignment, including where it sat on the student's ranking. */
export type ElectiveAssignment = {
  studentId: string;
  courseId: string;
  courseTitle: string;
  grade: number | null;
  /** Term in which the seat was granted (course's first term). */
  termId: string;
  /** Every term this seat counts toward (multi-term courses list all). */
  countedTermIds: string[];
  /** 1-based position in that term's reconstructed ranking when assigned. */
  preferenceRank: number;
  day: number;
  start: number;
  end: number;
};

export type ElectiveSortResult = {
  /** courseId → roster strings (one per occupied class). */
  rosters: Record<string, RosterEntry[]>;
  /** studentId → sorted [term_rank, day, start, end] quads. */
  timesTaken: Record<string, number[][]>;
  seed: number;
  shortfalls: ElectiveShortfall[];
  classFills: ClassFill[];
  /** Every seat granted during the run (in-memory; never written by itself). */
  assignments: ElectiveAssignment[];
};

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) + Fisher-Yates
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function defaultSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

/** Inclusive-start / exclusive-end overlap on the same day. */
export function timesOverlap(
  a: { day: number; start: number; end: number },
  b: { day: number; start: number; end: number },
): boolean {
  if (a.day !== b.day) return false;
  return a.start < b.end && b.start < a.end;
}

function buildRosterEntry(t: ClassTime, studentIds: string[]): string {
  return `${classTimeKey(t)}|${studentIds.join(",")}`;
}

// ---------------------------------------------------------------------------
// Core algorithm
// ---------------------------------------------------------------------------

/**
 * Assigns students to elective classes from submitted rankings.
 *
 * @param input School-scoped data (foreign students/courses must already be
 *   filtered out by the loader). Ranking rows whose student or course is
 *   unknown are ignored.
 * @param seed Optional RNG seed. When omitted, a random seed is chosen and
 *   returned in the result so the run can be replayed.
 */
export function runElectiveSort(
  input: ElectiveSortInput,
  seed?: number,
): ElectiveSortResult {
  const usedSeed = seed ?? defaultSeed();
  const rand = mulberry32(usedSeed);

  const required = Math.max(0, Math.floor(input.electivesAssigned));
  const terms = [...input.terms].sort((a, b) => a.rank - b.rank);

  const courseById = new Map<string, ElectiveCourse>();
  for (const course of input.courses) {
    courseById.set(course.id, course);
  }

  const studentById = new Map<string, ElectiveStudent>();
  for (const student of input.students) {
    studentById.set(student.id, student);
  }

  // Rankings grouped by student, ignoring unknown students/courses.
  const rankingsByStudent = new Map<string, ElectiveRanking[]>();
  for (const row of input.rankings) {
    if (!studentById.has(row.studentId)) continue;
    if (!courseById.has(row.courseId)) continue;
    const list = rankingsByStudent.get(row.studentId);
    if (list) {
      list.push(row);
    } else {
      rankingsByStudent.set(row.studentId, [row]);
    }
  }

  // Mutable per-class rosters: courseId → classKey → student ids.
  const rosterMap = new Map<string, Map<string, string[]>>();
  for (const course of input.courses) {
    const sections = new Map<string, string[]>();
    for (const block of course.schedule) {
      sections.set(classTimeKey(block), []);
    }
    rosterMap.set(course.id, sections);
  }

  // studentId → times_taken quads (mutated as we assign).
  const timesTaken = new Map<string, number[][]>();
  for (const student of input.students) {
    timesTaken.set(student.id, []);
  }

  // studentId → termId → number of electives already held in that term.
  // Multi-term courses increment every spanned term.
  const heldByTerm = new Map<string, Map<string, number>>();
  for (const student of input.students) {
    heldByTerm.set(student.id, new Map());
  }

  // studentId → set of course ids already assigned.
  const assignedCourses = new Map<string, Set<string>>();
  for (const student of input.students) {
    assignedCourses.set(student.id, new Set());
  }

  // Track shortfalls: studentId|termId → shortfall record (updated each round).
  const shortfallMap = new Map<string, ElectiveShortfall>();

  const assignments: ElectiveAssignment[] = [];

  // Grades present, highest first.
  const grades = [
    ...new Set(
      input.students
        .map((s) => s.grade)
        .filter((g): g is number => g !== null && Number.isFinite(g)),
    ),
  ].sort((a, b) => b - a);

  function termRankOf(termId: string): number | undefined {
    return terms.find((t) => t.id === termId)?.rank;
  }

  /** Lowest term-rank among a course's term_options (= its "first" term). */
  function firstTermId(course: ElectiveCourse): string | null {
    let best: { id: string; rank: number } | null = null;
    for (const tid of course.termOptions) {
      const rank = termRankOf(tid);
      if (rank === undefined) continue;
      if (!best || rank < best.rank) best = { id: tid, rank };
    }
    return best?.id ?? null;
  }

  /**
   * Reconstruct a student's ranking for a term column: courses whose
   * term_options include the term, ordered by preference ASC then title, id.
   */
  function rankingForTerm(studentId: string, termId: string): ElectiveCourse[] {
    const rows = rankingsByStudent.get(studentId) ?? [];
    const eligible: { course: ElectiveCourse; preference: number }[] = [];
    for (const row of rows) {
      const course = courseById.get(row.courseId);
      if (!course) continue;
      if (!course.termOptions.includes(termId)) continue;
      eligible.push({
        course,
        preference: row.preference ?? Number.MAX_SAFE_INTEGER,
      });
    }
    eligible.sort((a, b) => {
      if (a.preference !== b.preference) return a.preference - b.preference;
      const titleCmp = a.course.title.localeCompare(b.course.title);
      if (titleCmp !== 0) return titleCmp;
      return a.course.id.localeCompare(b.course.id);
    });
    return eligible.map((e) => e.course);
  }

  function isGradeEligible(course: ElectiveCourse, grade: number | null): boolean {
    if (grade === null) return false;
    if (!course.grade || course.grade.length === 0) return false;
    return course.grade.includes(grade);
  }

  function isFull(course: ElectiveCourse, classKey: string): boolean {
    if (course.maxStudentCount < 0) return false;
    const roster = rosterMap.get(course.id)?.get(classKey) ?? [];
    return roster.length >= course.maxStudentCount;
  }

  function studentConflicts(
    studentId: string,
    block: ClassTime,
    spannedTermRanks: number[],
  ): boolean {
    const existing = timesTaken.get(studentId) ?? [];
    for (const quad of existing) {
      const [termRank, day, start, end] = quad;
      if (termRank === undefined || day === undefined || start === undefined || end === undefined) {
        continue;
      }
      if (!spannedTermRanks.includes(termRank)) continue;
      if (timesOverlap(block, { day, start, end })) return true;
    }
    return false;
  }

  /**
   * Pick the least-full open, conflict-free class. Tie-break by (day, start).
   * Returns null if none fit.
   */
  function pickClass(
    course: ElectiveCourse,
    studentId: string,
  ): ClassTime | null {
    const spannedRanks = course.termOptions
      .map((tid) => termRankOf(tid))
      .filter((r): r is number => r !== undefined);

    if (spannedRanks.length === 0) return null;

    type Candidate = { block: ClassTime; key: string; count: number };
    const candidates: Candidate[] = [];

    for (const block of course.schedule) {
      const key = classTimeKey(block);
      if (isFull(course, key)) continue;
      if (studentConflicts(studentId, block, spannedRanks)) continue;
      const count = rosterMap.get(course.id)?.get(key)?.length ?? 0;
      candidates.push({ block, key, count });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      if (a.count !== b.count) return a.count - b.count;
      if (a.block.day !== b.block.day) return a.block.day - b.block.day;
      return a.block.start - b.block.start;
    });

    return candidates[0]!.block;
  }

  function assign(
    student: ElectiveStudent,
    course: ElectiveCourse,
    block: ClassTime,
    termId: string,
    preferenceRank: number,
  ): void {
    const key = classTimeKey(block);
    const sections = rosterMap.get(course.id);
    if (!sections) return;
    const roster = sections.get(key);
    if (!roster) {
      sections.set(key, [student.id]);
    } else {
      roster.push(student.id);
    }

    assignedCourses.get(student.id)?.add(course.id);

    const quads = timesTaken.get(student.id) ?? [];
    const held = heldByTerm.get(student.id)!;

    for (const tid of course.termOptions) {
      const rank = termRankOf(tid);
      if (rank === undefined) continue;
      quads.push([rank, block.day, block.start, block.end]);
      held.set(tid, (held.get(tid) ?? 0) + 1);
    }

    // Keep times_taken ordered by term, day, start.
    quads.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
    timesTaken.set(student.id, quads);

    assignments.push({
      studentId: student.id,
      courseId: course.id,
      courseTitle: course.title,
      grade: student.grade,
      termId,
      countedTermIds: course.termOptions.filter(
        (tid) => termRankOf(tid) !== undefined,
      ),
      preferenceRank,
      day: block.day,
      start: block.start,
      end: block.end,
    });
  }

  // -------------------------------------------------------------------------
  // Main loops: grade (high→low) → term (display order) → round → shuffle
  // -------------------------------------------------------------------------

  for (const grade of grades) {
    const gradeStudents = input.students.filter((s) => s.grade === grade);

    for (const term of terms) {
      for (let round = 1; round <= required; round += 1) {
        const order = [...gradeStudents];
        shuffleInPlace(order, rand);

        for (const student of order) {
          const held = heldByTerm.get(student.id)?.get(term.id) ?? 0;
          if (held >= round) continue;

          const ranking = rankingForTerm(student.id, term.id);
          let placed = false;

          for (let rankIdx = 0; rankIdx < ranking.length; rankIdx += 1) {
            const course = ranking[rankIdx]!;
            // Only assign in the course's first term.
            if (firstTermId(course) !== term.id) continue;
            if (!isGradeEligible(course, student.grade)) continue;
            if (course.schedule.length === 0) continue;
            if (assignedCourses.get(student.id)?.has(course.id)) continue;

            const block = pickClass(course, student.id);
            if (!block) continue;

            assign(student, course, block, term.id, rankIdx + 1);
            placed = true;
            break;
          }

          if (!placed) {
            const assigned = heldByTerm.get(student.id)?.get(term.id) ?? 0;
            if (assigned < required) {
              const key = `${student.id}|${term.id}`;
              shortfallMap.set(key, {
                studentId: student.id,
                termId: term.id,
                grade: student.grade,
                assigned,
                required,
              });
            }
          } else {
            // Clear shortfall if they somehow caught up (shouldn't happen mid-round
            // for this term, but keep the map accurate after later rounds).
            const assigned = heldByTerm.get(student.id)?.get(term.id) ?? 0;
            const key = `${student.id}|${term.id}`;
            if (assigned >= required) {
              shortfallMap.delete(key);
            } else {
              shortfallMap.set(key, {
                studentId: student.id,
                termId: term.id,
                grade: student.grade,
                assigned,
                required,
              });
            }
          }
        }
      }
    }
  }

  // Finalize shortfalls: anyone still under quota.
  for (const student of input.students) {
    for (const term of terms) {
      const assigned = heldByTerm.get(student.id)?.get(term.id) ?? 0;
      if (assigned < required) {
        shortfallMap.set(`${student.id}|${term.id}`, {
          studentId: student.id,
          termId: term.id,
          grade: student.grade,
          assigned,
          required,
        });
      } else {
        shortfallMap.delete(`${student.id}|${term.id}`);
      }
    }
  }

  // Build output rosters (omit empty class entries, matching DB convention).
  const rosters: Record<string, RosterEntry[]> = {};
  for (const course of input.courses) {
    const sections = rosterMap.get(course.id);
    if (!sections) continue;
    const entries: RosterEntry[] = [];
    for (const block of course.schedule) {
      const key = classTimeKey(block);
      const ids = sections.get(key) ?? [];
      if (ids.length === 0) continue;
      entries.push(buildRosterEntry(block, ids));
    }
    if (entries.length > 0) {
      rosters[course.id] = entries;
    }
  }

  const timesTakenOut: Record<string, number[][]> = {};
  for (const [studentId, quads] of timesTaken) {
    if (quads.length > 0) {
      timesTakenOut[studentId] = quads;
    }
  }

  const classFills: ClassFill[] = [];
  for (const course of input.courses) {
    const sections = rosterMap.get(course.id);
    if (!sections) continue;
    for (const block of course.schedule) {
      const key = classTimeKey(block);
      const count = sections.get(key)?.length ?? 0;
      classFills.push({
        courseId: course.id,
        day: block.day,
        start: block.start,
        end: block.end,
        count,
        capacity: course.maxStudentCount,
      });
    }
  }

  return {
    rosters,
    timesTaken: timesTakenOut,
    seed: usedSeed,
    shortfalls: [...shortfallMap.values()],
    classFills,
    assignments,
  };
}
