/**
 * testsort — same algorithm as sort, but never writes to Supabase.
 *
 * Loads live school data, runs the assignment in memory (arrays only),
 * aggregates preference-rank coverage and class-fill histograms, and prints
 * the report to the console (including submission notes).
 */

import {
  loadElectiveData,
  type ElectiveClient,
} from "./loadElectiveData";
import {
  runElectiveSort,
  type ElectiveAssignment,
  type ElectiveCourse,
  type ElectiveSortResult,
  type ElectiveTerm,
} from "../utils/electiveSort";

export type TestSortOptions = {
  seed?: number;
  client?: ElectiveClient;
};

/** Preference-rank coverage for a cohort of students. */
export type RankCoverage = {
  /** Distinct students in the cohort. */
  studentTotal: number;
  /** Assignment rows attributed to this cohort. */
  assignmentTotal: number;
  /**
   * For each preference rank R that at least one student received:
   * studentsWith = students who got rank R as one of their assigned classes
   * count = assignmentTotal * (studentsWith / studentTotal)
   *   so if everyone got R, count equals assignmentTotal and pct is 100%
   * pct = 100 * studentsWith / studentTotal
   */
  ranks: Record<
    number,
    { studentsWith: number; count: number; pct: number }
  >;
};

export type SubmissionNoteLine = {
  studentName: string;
  grade: number | null;
  note: string;
};

export type TestSortReport = {
  result: ElectiveSortResult;
  terms: ElectiveTerm[];
  byGrade: Record<string, RankCoverage>;
  byTerm: Record<string, RankCoverage>;
  byTermAndGrade: Record<string, Record<string, RankCoverage>>;
  /** termId → studentCount → number of courses offered that term with that enrollment. */
  courseSizeCountsByTerm: Record<string, Record<number, number>>;
  /** studentCount → number of classes with that many students (includes 0). */
  classSizeCounts: Record<number, number>;
  /** Non-empty submitted_notes for the school, with student name + grade. */
  submissionNotes: SubmissionNoteLine[];
};

export type TestSortResult =
  | { report: TestSortReport; error?: undefined }
  | { report?: undefined; error: string };

function sortGradeKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === "null") return 1;
    if (b === "null") return -1;
    return Number(b) - Number(a);
  });
}

/**
 * Build coverage stats: a student who received preference rank R as any of
 * their assigned classes counts fully toward R (pct = share of students).
 * Display count scales to assignmentTotal so 100% coverage → count equals
 * the cohort's assignment total.
 */
function coverageFromAssignments(
  rows: { studentId: string; preferenceRank: number }[],
): RankCoverage {
  const ranksByStudent = new Map<string, Set<number>>();
  for (const row of rows) {
    let set = ranksByStudent.get(row.studentId);
    if (!set) {
      set = new Set();
      ranksByStudent.set(row.studentId, set);
    }
    set.add(row.preferenceRank);
  }

  const studentTotal = ranksByStudent.size;
  const assignmentTotal = rows.length;
  const ranks: RankCoverage["ranks"] = {};

  if (studentTotal === 0) {
    return { studentTotal: 0, assignmentTotal: 0, ranks };
  }

  const studentsWithByRank = new Map<number, number>();
  for (const set of ranksByStudent.values()) {
    for (const r of set) {
      studentsWithByRank.set(r, (studentsWithByRank.get(r) ?? 0) + 1);
    }
  }

  for (const [preferenceRank, studentsWith] of [...studentsWithByRank.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const pct = (100 * studentsWith) / studentTotal;
    const count = (assignmentTotal * studentsWith) / studentTotal;
    ranks[preferenceRank] = { studentsWith, count, pct };
  }

  return { studentTotal, assignmentTotal, ranks };
}

function aggregateByGrade(
  assignments: ElectiveAssignment[],
): Record<string, RankCoverage> {
  const rowsByGrade = new Map<
    string,
    { studentId: string; preferenceRank: number }[]
  >();

  for (const a of assignments) {
    const gradeKey = a.grade === null ? "null" : String(a.grade);
    const list = rowsByGrade.get(gradeKey) ?? [];
    list.push({ studentId: a.studentId, preferenceRank: a.preferenceRank });
    rowsByGrade.set(gradeKey, list);
  }

  const out: Record<string, RankCoverage> = {};
  for (const [gradeKey, rows] of rowsByGrade) {
    out[gradeKey] = coverageFromAssignments(rows);
  }
  return out;
}

function aggregateByTerm(
  assignments: ElectiveAssignment[],
): {
  byTerm: Record<string, RankCoverage>;
  byTermAndGrade: Record<string, Record<string, RankCoverage>>;
} {
  const rowsByTerm = new Map<
    string,
    { studentId: string; preferenceRank: number; gradeKey: string }[]
  >();

  for (const a of assignments) {
    const termIds =
      a.countedTermIds.length > 0 ? a.countedTermIds : [a.termId];
    const gradeKey = a.grade === null ? "null" : String(a.grade);
    for (const termId of termIds) {
      const list = rowsByTerm.get(termId) ?? [];
      list.push({
        studentId: a.studentId,
        preferenceRank: a.preferenceRank,
        gradeKey,
      });
      rowsByTerm.set(termId, list);
    }
  }

  const byTerm: Record<string, RankCoverage> = {};
  const byTermAndGrade: Record<string, Record<string, RankCoverage>> = {};

  for (const [termId, rows] of rowsByTerm) {
    byTerm[termId] = coverageFromAssignments(rows);

    const byGradeRows = new Map<
      string,
      { studentId: string; preferenceRank: number }[]
    >();
    for (const row of rows) {
      const list = byGradeRows.get(row.gradeKey) ?? [];
      list.push({
        studentId: row.studentId,
        preferenceRank: row.preferenceRank,
      });
      byGradeRows.set(row.gradeKey, list);
    }

    const gradeMap: Record<string, RankCoverage> = {};
    for (const [gradeKey, gradeRows] of byGradeRows) {
      gradeMap[gradeKey] = coverageFromAssignments(gradeRows);
    }
    byTermAndGrade[termId] = gradeMap;
  }

  return { byTerm, byTermAndGrade };
}

function aggregateClassSizes(
  classFills: ElectiveSortResult["classFills"],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const fill of classFills) {
    counts[fill.count] = (counts[fill.count] ?? 0) + 1;
  }
  return counts;
}

/**
 * Per term: histogram of total enrollment for courses offered in that term.
 * All-year courses appear under every term they cover, with the same headcount.
 */
function aggregateCourseSizesByTerm(
  classFills: ElectiveSortResult["classFills"],
  courses: ElectiveCourse[],
): Record<string, Record<number, number>> {
  const enrollmentByCourse = new Map<string, number>();
  for (const fill of classFills) {
    enrollmentByCourse.set(
      fill.courseId,
      (enrollmentByCourse.get(fill.courseId) ?? 0) + fill.count,
    );
  }

  const byTerm: Record<string, Record<number, number>> = {};
  for (const course of courses) {
    const total = enrollmentByCourse.get(course.id) ?? 0;
    for (const termId of course.termOptions) {
      const counts = byTerm[termId] ?? (byTerm[termId] = {});
      counts[total] = (counts[total] ?? 0) + 1;
    }
  }
  return byTerm;
}

function printSizeHistogram(
  title: string,
  sizeCounts: Record<number, number>,
  unit: "course" | "class",
  indent = "",
): void {
  const plural = unit === "class" ? "classes" : "courses";
  console.log(`\n${indent}--- ${title} ---`);
  const sizes = Object.keys(sizeCounts)
    .map(Number)
    .sort((a, b) => b - a);
  if (sizes.length === 0) {
    console.log(`${indent}  (no ${plural})`);
    return;
  }
  let total = 0;
  for (const size of sizes) {
    const n = sizeCounts[size]!;
    total += n;
    const unitLabel = n === 1 ? unit : plural;
    console.log(
      `${indent}  ${n} ${unitLabel}: ${size} student${size === 1 ? "" : "s"}`,
    );
  }
  console.log(`${indent}  Total ${plural}: ${total}`);
}

function printCourseSizesByTerm(
  terms: ElectiveTerm[],
  courseSizeCountsByTerm: Record<string, Record<number, number>>,
): void {
  console.log("\n--- Course sizes by term ---");
  const orderedTerms = [...terms].sort((a, b) => a.rank - b.rank);
  if (orderedTerms.length === 0) {
    console.log("  (no terms)");
    return;
  }
  for (const term of orderedTerms) {
    const counts = courseSizeCountsByTerm[term.id] ?? {};
    printSizeHistogram(termLabel(term), counts, "course", "  ");
  }
}

const NOTES_PAGE_SIZE = 1000;

async function resolveClient(client?: ElectiveClient): Promise<ElectiveClient> {
  if (client) return client;
  const { supabase } = await import("./supabase");
  return supabase;
}

/** Load non-empty submitted_notes for a school, with student name and grade. */
async function loadSubmissionNotes(
  schoolId: string,
  client?: ElectiveClient,
): Promise<{ notes: SubmissionNoteLine[]; error?: string }> {
  const db = await resolveClient(client);
  const notes: SubmissionNoteLine[] = [];

  for (let from = 0; ; from += NOTES_PAGE_SIZE) {
    const to = from + NOTES_PAGE_SIZE - 1;
    const { data, error } = await db
      .from("submitted_notes")
      .select("note, students!inner(name, grade, school_id)")
      .eq("students.school_id", schoolId)
      .range(from, to);

    if (error) return { notes, error: error.message };
    if (!data?.length) break;

    for (const row of data) {
      const note = row.note?.trim() ?? "";
      if (!note) continue;
      const student = row.students as {
        name: string;
        grade: number | null;
        school_id: string;
      };
      notes.push({
        studentName: student.name,
        grade: student.grade,
        note,
      });
    }

    if (data.length < NOTES_PAGE_SIZE) break;
  }

  notes.sort((a, b) => {
    const ga = a.grade ?? Number.POSITIVE_INFINITY;
    const gb = b.grade ?? Number.POSITIVE_INFINITY;
    if (ga !== gb) return gb - ga;
    return a.studentName.localeCompare(b.studentName);
  });

  return { notes };
}

function printRankCoverage(coverage: RankCoverage, indent: string): void {
  const rankNums = Object.keys(coverage.ranks)
    .map(Number)
    .sort((a, b) => a - b);
  for (const r of rankNums) {
    const { count, pct } = coverage.ranks[r]!;
    const countLabel = Number.isInteger(count) ? String(count) : count.toFixed(1);
    console.log(
      `${indent}${ordinal(r)} choice: ${countLabel} (${pct.toFixed(1)}%)`,
    );
  }
}

function termLabel(term: ElectiveTerm): string {
  if (term.name) return `${term.name} (rank ${term.rank})`;
  return `Term rank ${term.rank}`;
}

/** Print the in-memory testsort report to stdout. */
export function printTestSortReport(report: TestSortReport): void {
  const {
    result,
    terms,
    byGrade,
    byTerm,
    byTermAndGrade,
    courseSizeCountsByTerm,
    classSizeCounts,
    submissionNotes,
  } = report;

  console.log("\n========== testsort results (no DB writes) ==========");
  console.log(`Seed: ${result.seed}`);
  console.log(`Total assignments: ${result.assignments.length}`);
  console.log(`Courses with rosters: ${Object.keys(result.rosters).length}`);
  console.log(
    `Students with times_taken: ${Object.keys(result.timesTaken).length}`,
  );
  console.log(`Shortfalls: ${result.shortfalls.length}`);
  console.log(`Displacements: ${result.displacements.length}`);

  if (result.displacements.length > 0) {
    console.log(`\n--- Displacements (${result.displacements.length}) ---`);
    console.log(
      "(a seated student slid further down their own list so a student with no",
    );
    console.log(" usable open class could take their seat)");
    for (const d of result.displacements) {
      console.log(
        `  student=${d.displacedStudentId} grade=${d.displacedGrade} term=${d.termId}` +
          ` moved ${ordinal(d.fromPreferenceRank)} "${d.fromCourseTitle}"` +
          ` → ${ordinal(d.toPreferenceRank)} "${d.toCourseTitle}"` +
          ` for student=${d.beneficiaryStudentId} grade=${d.beneficiaryGrade}` +
          ` (their ${ordinal(d.beneficiaryPreferenceRank)} choice)`,
      );
    }
  }

  console.log("\n--- Assignments by grade × preference rank ---");
  console.log(
    "(pct = share of students who received that choice as one of their assigned classes;",
  );
  console.log(
    " count scales to the cohort's assignment total, so 100% → count equals assignments)",
  );

  for (const gradeKey of sortGradeKeys(Object.keys(byGrade))) {
    const label = gradeKey === "null" ? "unknown" : gradeKey;
    const coverage = byGrade[gradeKey]!;
    console.log(
      `\nGrade ${label} — ${coverage.assignmentTotal} assignment(s), ${coverage.studentTotal} student(s):`,
    );
    printRankCoverage(coverage, "  ");
  }

  console.log("\n--- Assignments by term × preference rank ---");
  const orderedTerms = [...terms].sort((a, b) => a.rank - b.rank);
  for (const term of orderedTerms) {
    const coverage = byTerm[term.id];
    if (!coverage || coverage.assignmentTotal === 0) {
      console.log(`\n${termLabel(term)} — 0 assignment(s)`);
      continue;
    }
    console.log(
      `\n${termLabel(term)} — ${coverage.assignmentTotal} assignment(s), ${coverage.studentTotal} student(s):`,
    );
    printRankCoverage(coverage, "  ");

    const byGradeInTerm = byTermAndGrade[term.id] ?? {};
    for (const gradeKey of sortGradeKeys(Object.keys(byGradeInTerm))) {
      const gradeLabel = gradeKey === "null" ? "unknown" : gradeKey;
      const gradeCoverage = byGradeInTerm[gradeKey]!;
      console.log(
        `  Grade ${gradeLabel} — ${gradeCoverage.assignmentTotal} assignment(s), ${gradeCoverage.studentTotal} student(s):`,
      );
      printRankCoverage(gradeCoverage, "    ");
    }
  }

  printCourseSizesByTerm(terms, courseSizeCountsByTerm);
  printSizeHistogram("Class sizes", classSizeCounts, "class");

  if (result.shortfalls.length > 0) {
    console.log(`\n--- Shortfalls (${result.shortfalls.length}) ---`);
    for (const s of result.shortfalls) {
      console.log(
        `  student=${s.studentId} grade=${s.grade} term=${s.termId} assigned=${s.assigned}/${s.required}`,
      );
    }
  }

  console.log(`\n--- Submission notes (${submissionNotes.length}) ---`);
  if (submissionNotes.length === 0) {
    console.log("  (none)");
  } else {
    for (const row of submissionNotes) {
      const gradeLabel = row.grade === null ? "unknown" : String(row.grade);
      console.log(`  ${row.studentName} (grade ${gradeLabel}): ${row.note}`);
    }
  }

  console.log("\n========== end testsort ==========\n");
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Load school data from Supabase, run the sort in memory only, print results.
 * Never calls apply / never writes rosters or times_taken.
 */
export async function testsort(
  schoolId: string,
  options: TestSortOptions = {},
): Promise<TestSortResult> {
  const [loaded, notesLoaded] = await Promise.all([
    loadElectiveData(schoolId, options.client),
    loadSubmissionNotes(schoolId, options.client),
  ]);
  if (loaded.error || !loaded.data) {
    return { error: loaded.error ?? "Failed to load elective data" };
  }
  if (notesLoaded.error) {
    return { error: notesLoaded.error };
  }

  const result = runElectiveSort(loaded.data, options.seed);
  const byGrade = aggregateByGrade(result.assignments);
  const { byTerm, byTermAndGrade } = aggregateByTerm(result.assignments);
  const courseSizeCountsByTerm = aggregateCourseSizesByTerm(
    result.classFills,
    loaded.data.courses,
  );
  const classSizeCounts = aggregateClassSizes(result.classFills);

  const report: TestSortReport = {
    result,
    terms: loaded.data.terms,
    byGrade,
    byTerm,
    byTermAndGrade,
    courseSizeCountsByTerm,
    classSizeCounts,
    submissionNotes: notesLoaded.notes,
  };
  printTestSortReport(report);

  return { report };
}
