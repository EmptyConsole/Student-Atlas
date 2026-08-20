/**
 * LEGACY elective-assignment algorithm (unused).
 *
 * Preserved for reference. The active engine lives in `electiveSort.ts`
 * (round-fair deferred acceptance + constrained repair + leftover fill).
 *
 * Previously: grade → term → round greedy lottery with cross-grade
 * cascading displacement post-pass.
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
  /**
   * School-wide seats per term. Used only when `electivesAssignedByGrade` is
   * omitted (unit tests / direct callers). With a map, unlisted grades are
   * skipped entirely rather than falling back here.
   */
  electivesAssigned: number;
  /**
   * Per-grade seats per term, from `schools.grade`. When provided, only
   * students whose grade is a key in this map are sorted.
   */
  electivesAssignedByGrade?: Record<number, number>;
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

/**
 * One seat handed from an already-placed student to a student who would
 * otherwise be short, with the displaced student sliding down their own list.
 */
export type ElectiveDisplacement = {
  /** Student moved down their ranking to free the seat. */
  displacedStudentId: string;
  displacedGrade: number | null;
  /** Student who received the freed seat. */
  beneficiaryStudentId: string;
  beneficiaryGrade: number | null;
  termId: string;
  fromCourseId: string;
  fromCourseTitle: string;
  /** Displaced student's rank for the vacated course. */
  fromPreferenceRank: number;
  toCourseId: string;
  toCourseTitle: string;
  /** Displaced student's rank for their replacement course (always worse). */
  toPreferenceRank: number;
  /** Beneficiary's rank for the course they moved into. */
  beneficiaryPreferenceRank: number;
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
  /** Seats reclaimed by the displacement pass, oldest first. */
  displacements: ElectiveDisplacement[];
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
export function runElectiveSortLegacy(
  input: ElectiveSortInput,
  seed?: number,
): ElectiveSortResult {
  const usedSeed = seed ?? defaultSeed();
  const rand = mulberry32(usedSeed);

  const byGrade = input.electivesAssignedByGrade;
  // When a per-grade map is supplied, drop students whose grade is not a key.
  const students =
    byGrade === undefined
      ? input.students
      : input.students.filter(
          (s) => s.grade !== null && Object.hasOwn(byGrade, s.grade),
        );

  /** Seats owed per term to a student in this grade. */
  function requiredFor(grade: number | null): number {
    if (grade !== null && byGrade !== undefined && Object.hasOwn(byGrade, grade)) {
      return Math.max(0, Math.floor(byGrade[grade]!));
    }
    // No map (or grade somehow unlisted): school-wide fallback.
    return Math.max(0, Math.floor(input.electivesAssigned));
  }

  const terms = [...input.terms].sort((a, b) => a.rank - b.rank);

  const courseById = new Map<string, ElectiveCourse>();
  for (const course of input.courses) {
    courseById.set(course.id, course);
  }

  const studentById = new Map<string, ElectiveStudent>();
  for (const student of students) {
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
  for (const student of students) {
    timesTaken.set(student.id, []);
  }

  // studentId → termId → number of electives already held in that term.
  // Multi-term courses increment every spanned term.
  const heldByTerm = new Map<string, Map<string, number>>();
  for (const student of students) {
    heldByTerm.set(student.id, new Map());
  }

  // studentId → set of course ids already assigned.
  const assignedCourses = new Map<string, Set<string>>();
  for (const student of students) {
    assignedCourses.set(student.id, new Set());
  }

  // Track shortfalls: studentId|termId → shortfall record (updated each round).
  const shortfallMap = new Map<string, ElectiveShortfall>();

  const assignments: ElectiveAssignment[] = [];

  // Grades present, highest first.
  const grades = [
    ...new Set(
      students
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

  /** Known term ranks a course occupies. */
  function spannedTermRanks(course: ElectiveCourse): number[] {
    return course.termOptions
      .map((tid) => termRankOf(tid))
      .filter((r): r is number => r !== undefined);
  }

  /** Stable signature of the terms a course occupies, for span comparisons. */
  function termSpanKey(course: ElectiveCourse): string {
    return course.termOptions
      .filter((tid) => termRankOf(tid) !== undefined)
      .sort()
      .join(",");
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
    const spannedRanks = spannedTermRanks(course);

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

  /** Everything needed to put a seat back exactly as it was. */
  type SavedSeat = {
    student: ElectiveStudent;
    course: ElectiveCourse;
    block: ClassTime;
    rosterIndex: number;
    assignmentIndex: number;
    assignment: ElectiveAssignment;
  };

  /**
   * Reverse of `assign`. Returns the state needed by `restoreSeat`, or null if
   * the student does not actually hold that seat.
   */
  function unassignSeat(
    student: ElectiveStudent,
    course: ElectiveCourse,
    block: ClassTime,
  ): SavedSeat | null {
    const key = classTimeKey(block);
    const roster = rosterMap.get(course.id)?.get(key);
    if (!roster) return null;
    const rosterIndex = roster.indexOf(student.id);
    if (rosterIndex < 0) return null;

    const assignmentIndex = assignments.findIndex(
      (a) =>
        a.studentId === student.id &&
        a.courseId === course.id &&
        a.day === block.day &&
        a.start === block.start &&
        a.end === block.end,
    );
    if (assignmentIndex < 0) return null;
    const assignment = assignments[assignmentIndex]!;

    roster.splice(rosterIndex, 1);
    assignedCourses.get(student.id)?.delete(course.id);

    const quads = timesTaken.get(student.id) ?? [];
    const held = heldByTerm.get(student.id)!;
    for (const tid of course.termOptions) {
      const rank = termRankOf(tid);
      if (rank === undefined) continue;
      const qi = quads.findIndex(
        (q) =>
          q[0] === rank &&
          q[1] === block.day &&
          q[2] === block.start &&
          q[3] === block.end,
      );
      if (qi >= 0) quads.splice(qi, 1);
      held.set(tid, Math.max(0, (held.get(tid) ?? 0) - 1));
    }

    assignments.splice(assignmentIndex, 1);
    return { student, course, block, rosterIndex, assignmentIndex, assignment };
  }

  function restoreSeat(saved: SavedSeat): void {
    const key = classTimeKey(saved.block);
    const roster = rosterMap.get(saved.course.id)?.get(key);
    if (roster) {
      roster.splice(saved.rosterIndex, 0, saved.student.id);
    }
    assignedCourses.get(saved.student.id)?.add(saved.course.id);

    const quads = timesTaken.get(saved.student.id) ?? [];
    const held = heldByTerm.get(saved.student.id)!;
    for (const tid of saved.course.termOptions) {
      const rank = termRankOf(tid);
      if (rank === undefined) continue;
      quads.push([rank, saved.block.day, saved.block.start, saved.block.end]);
      held.set(tid, (held.get(tid) ?? 0) + 1);
    }
    quads.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
    timesTaken.set(saved.student.id, quads);

    assignments.splice(saved.assignmentIndex, 0, saved.assignment);
  }

  // -------------------------------------------------------------------------
  // Main loops: grade (high→low) → term → round → shuffle
  // -------------------------------------------------------------------------

  for (const grade of grades) {
    const gradeStudents = students.filter((s) => s.grade === grade);
    const required = requiredFor(grade);

    for (const term of terms) {
      for (let round = 1; round <= required; round += 1) {
        const order = [...gradeStudents];
        shuffleInPlace(order, rand);

        for (const student of order) {
          const held = heldByTerm.get(student.id)?.get(term.id) ?? 0;
          if (held >= round) continue;

          const ranking = rankingForTerm(student.id, term.id);

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
            break;
          }

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

  // -------------------------------------------------------------------------
  // Displacement post-pass
  //
  // After the main loops, students still under quota can take a seat by
  // sliding an already-placed student further down their list (with
  // cascading). Younger students may displace a given person at most once;
  // older / same-grade students may re-displace them.
  // -------------------------------------------------------------------------

  const displacements: ElectiveDisplacement[] = [];
  /** Occupants already bumped by someone younger than them (or unknown grade). */
  const alreadyDisplaced = new Set<string>();
  const MAX_CASCADE_DEPTH = 8;

  function mayDisplace(
    beneficiary: ElectiveStudent,
    occupant: ElectiveStudent,
  ): boolean {
    if (!alreadyDisplaced.has(occupant.id)) return true;
    if (beneficiary.grade === null || occupant.grade === null) return false;
    return beneficiary.grade >= occupant.grade;
  }

  type BumpCandidate = {
    occupant: ElectiveStudent;
    course: ElectiveCourse;
    block: ClassTime;
    fromRank: number;
    beneficiaryRank: number;
  };

  function collectCandidates(
    student: ElectiveStudent,
    term: ElectiveTerm,
    inFlight: Set<string>,
    targetCourse: ElectiveCourse | null,
  ):
    | { tookOpen: true }
    | { tookOpen: false; candidates: BumpCandidate[] } {
    const ranking = rankingForTerm(student.id, term.id);
    const candidates: BumpCandidate[] = [];

    for (let idx = 0; idx < ranking.length; idx += 1) {
      const course = ranking[idx]!;
      if (targetCourse && course.id !== targetCourse.id) continue;
      if (firstTermId(course) !== term.id) continue;
      if (!isGradeEligible(course, student.grade)) continue;
      if (course.schedule.length === 0) continue;
      if (assignedCourses.get(student.id)?.has(course.id)) continue;

      const spannedRanks = spannedTermRanks(course);
      if (spannedRanks.length === 0) continue;

      const open = pickClass(course, student.id);
      if (open) {
        assign(student, course, open, term.id, idx + 1);
        return { tookOpen: true };
      }

      for (const block of course.schedule) {
        if (studentConflicts(student.id, block, spannedRanks)) continue;
        const roster = rosterMap.get(course.id)?.get(classTimeKey(block)) ?? [];
        for (const occupantId of roster) {
          if (occupantId === student.id) continue;
          if (inFlight.has(occupantId)) continue;
          const occupant = studentById.get(occupantId);
          if (!occupant) continue;
          if (!mayDisplace(student, occupant)) continue;

          const occupantRanking = rankingForTerm(occupantId, term.id);
          const fromRank =
            occupantRanking.findIndex((c) => c.id === course.id) + 1;
          if (fromRank <= 0) continue;
          if (fromRank >= occupantRanking.length) continue;

          candidates.push({
            occupant,
            course,
            block,
            fromRank,
            beneficiaryRank: idx + 1,
          });
        }
      }
    }

    return { tookOpen: false, candidates };
  }

  function sortCandidates(candidates: BumpCandidate[]): void {
    shuffleInPlace(candidates, rand);
    candidates.sort((a, b) => {
      if (a.fromRank !== b.fromRank) return b.fromRank - a.fromRank;
      const ga = a.occupant.grade ?? Number.POSITIVE_INFINITY;
      const gb = b.occupant.grade ?? Number.POSITIVE_INFINITY;
      return ga - gb;
    });
  }

  function slideDown(
    candidate: BumpCandidate,
    term: ElectiveTerm,
    depth: number,
    inFlight: Set<string>,
  ): { course: ElectiveCourse; rank: number } | null {
    const ranking = rankingForTerm(candidate.occupant.id, term.id);
    const fromSpan = termSpanKey(candidate.course);

    const saved = unassignSeat(
      candidate.occupant,
      candidate.course,
      candidate.block,
    );
    if (!saved) return null;

    inFlight.add(candidate.occupant.id);

    for (let i = candidate.fromRank; i < ranking.length; i += 1) {
      const next = ranking[i]!;
      if (next.id === candidate.course.id) continue;
      if (firstTermId(next) !== term.id) continue;
      if (!isGradeEligible(next, candidate.occupant.grade)) continue;
      if (next.schedule.length === 0) continue;
      if (assignedCourses.get(candidate.occupant.id)?.has(next.id)) continue;
      if (termSpanKey(next) !== fromSpan) continue;

      const open = pickClass(next, candidate.occupant.id);
      if (open) {
        assign(candidate.occupant, next, open, term.id, i + 1);
        inFlight.delete(candidate.occupant.id);
        return { course: next, rank: i + 1 };
      }

      if (depth + 1 > MAX_CASCADE_DEPTH) continue;
      if (
        !claimSeat(candidate.occupant, term, depth + 1, inFlight, next, i + 1)
      ) {
        continue;
      }
      inFlight.delete(candidate.occupant.id);
      return { course: next, rank: i + 1 };
    }

    inFlight.delete(candidate.occupant.id);
    restoreSeat(saved);
    return null;
  }

  function claimSeat(
    student: ElectiveStudent,
    term: ElectiveTerm,
    depth: number,
    inFlight: Set<string>,
    targetCourse: ElectiveCourse | null,
    beneficiaryRankOverride: number | null,
  ): boolean {
    if (depth > MAX_CASCADE_DEPTH) return false;

    const collected = collectCandidates(student, term, inFlight, targetCourse);
    if (collected.tookOpen) return true;

    const { candidates } = collected;
    if (candidates.length === 0) return false;
    sortCandidates(candidates);

    for (const candidate of candidates) {
      const dispLen = displacements.length;
      const moved = slideDown(candidate, term, depth, inFlight);
      if (!moved) {
        displacements.length = dispLen;
        continue;
      }

      const beneficiaryRank =
        beneficiaryRankOverride ?? candidate.beneficiaryRank;
      assign(
        student,
        candidate.course,
        candidate.block,
        term.id,
        beneficiaryRank,
      );
      alreadyDisplaced.add(candidate.occupant.id);
      displacements.push({
        displacedStudentId: candidate.occupant.id,
        displacedGrade: candidate.occupant.grade,
        beneficiaryStudentId: student.id,
        beneficiaryGrade: student.grade,
        termId: term.id,
        fromCourseId: candidate.course.id,
        fromCourseTitle: candidate.course.title,
        fromPreferenceRank: candidate.fromRank,
        toCourseId: moved.course.id,
        toCourseTitle: moved.course.title,
        toPreferenceRank: moved.rank,
        beneficiaryPreferenceRank: beneficiaryRank,
      });
      return true;
    }

    return false;
  }

  function fillOneSeat(student: ElectiveStudent, term: ElectiveTerm): boolean {
    return claimSeat(student, term, 0, new Set(), null, null);
  }

  // Sweep until a full pass seats nobody else. Older/same-grade students may
  // re-bump, so progress is bounded by remaining shortfalls, not by a hard
  // once-per-student cap.
  for (;;) {
    let progress = false;

    for (const grade of grades) {
      const required = requiredFor(grade);
      if (required <= 0) continue;

      const order = students.filter((s) => s.grade === grade);
      shuffleInPlace(order, rand);

      for (const student of order) {
        for (const term of terms) {
          while ((heldByTerm.get(student.id)?.get(term.id) ?? 0) < required) {
            if (!fillOneSeat(student, term)) break;
            progress = true;
          }
        }
      }
    }

    if (!progress) break;
  }

  // Finalize shortfalls: anyone still under quota.
  for (const student of students) {
    const required = requiredFor(student.grade);
    for (const term of terms) {
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
    displacements,
  };
}
