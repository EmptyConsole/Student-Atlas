/**
 * testsort — same algorithm as sort, but never writes to Supabase.
 *
 * Loads live school data, runs the assignment in memory (arrays only),
 * aggregates preference quality / missing seats / leftovers, and prints
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

/** Best-preference quality for a cohort (leftover seats excluded). */
export type BestRankCoverage = {
  studentTotal: number;
  /** Students with at least one non-leftover assignment. */
  rankedStudentTotal: number;
  /**
   * For each best preference rank R among a student's non-leftover seats:
   * studentsWith = students whose best assigned rank is R
   * pct = 100 * studentsWith / studentTotal
   */
  ranks: Record<number, { studentsWith: number; pct: number }>;
  /** Students whose only seats are leftovers (or none ranked). */
  leftoverOnlyStudents: number;
};

export type SubmissionNoteLine = {
  studentName: string;
  grade: number | null;
  note: string;
};

export type MissingSeatsByGrade = Record<
  string,
  { records: number; missingSeats: number }
>;

export type TestSortReport = {
  result: ElectiveSortResult;
  terms: ElectiveTerm[];
  missingSeatsTotal: number;
  missingSeatsByGrade: MissingSeatsByGrade;
  leftoverAssignments: number;
  leftoverByGrade: Record<string, number>;
  bestByGrade: Record<string, BestRankCoverage>;
  bestByTerm: Record<string, BestRankCoverage>;
  bestByTermAndGrade: Record<string, Record<string, BestRankCoverage>>;
  /** termId → studentCount → number of courses offered that term with that enrollment. */
  courseSizeCountsByTerm: Record<string, Record<number, number>>;
  /** studentCount → number of classes with that many students (includes 0). */
  classSizeCounts: Record<number, number>;
  /** Displaced grade → beneficiary grade → hop count. */
  displacementMatrix: Record<string, Record<string, number>>;
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

function gradeKeyOf(grade: number | null): string {
  return grade === null ? "null" : String(grade);
}

function bestRankCoverage(
  rows: { studentId: string; preferenceRank: number; leftover?: boolean }[],
): BestRankCoverage {
  const bestByStudent = new Map<string, number>();
  const leftoverOnly = new Set<string>();
  const seen = new Set<string>();

  for (const row of rows) {
    seen.add(row.studentId);
    if (row.leftover) {
      if (!bestByStudent.has(row.studentId)) {
        leftoverOnly.add(row.studentId);
      }
      continue;
    }
    leftoverOnly.delete(row.studentId);
    const prev = bestByStudent.get(row.studentId);
    if (prev === undefined || row.preferenceRank < prev) {
      bestByStudent.set(row.studentId, row.preferenceRank);
    }
  }

  const ranks: BestRankCoverage["ranks"] = {};
  for (const r of bestByStudent.values()) {
    const entry = ranks[r] ?? { studentsWith: 0, pct: 0 };
    entry.studentsWith += 1;
    ranks[r] = entry;
  }

  const studentTotal = seen.size;
  for (const r of Object.keys(ranks).map(Number)) {
    ranks[r]!.pct =
      studentTotal === 0 ? 0 : (100 * ranks[r]!.studentsWith) / studentTotal;
  }

  return {
    studentTotal,
    rankedStudentTotal: bestByStudent.size,
    ranks,
    leftoverOnlyStudents: leftoverOnly.size,
  };
}

function aggregateBestByGrade(
  assignments: ElectiveAssignment[],
): Record<string, BestRankCoverage> {
  const rowsByGrade = new Map<
    string,
    { studentId: string; preferenceRank: number; leftover?: boolean }[]
  >();

  for (const a of assignments) {
    const key = gradeKeyOf(a.grade);
    const list = rowsByGrade.get(key) ?? [];
    list.push({
      studentId: a.studentId,
      preferenceRank: a.preferenceRank,
      leftover: a.leftover,
    });
    rowsByGrade.set(key, list);
  }

  const out: Record<string, BestRankCoverage> = {};
  for (const [gradeKey, rows] of rowsByGrade) {
    out[gradeKey] = bestRankCoverage(rows);
  }
  return out;
}

function aggregateBestByTerm(
  assignments: ElectiveAssignment[],
): {
  byTerm: Record<string, BestRankCoverage>;
  byTermAndGrade: Record<string, Record<string, BestRankCoverage>>;
} {
  const rowsByTerm = new Map<
    string,
    {
      studentId: string;
      preferenceRank: number;
      leftover?: boolean;
      gradeKey: string;
    }[]
  >();

  for (const a of assignments) {
    const termIds =
      a.countedTermIds.length > 0 ? a.countedTermIds : [a.termId];
    const gradeKey = gradeKeyOf(a.grade);
    for (const termId of termIds) {
      const list = rowsByTerm.get(termId) ?? [];
      list.push({
        studentId: a.studentId,
        preferenceRank: a.preferenceRank,
        leftover: a.leftover,
        gradeKey,
      });
      rowsByTerm.set(termId, list);
    }
  }

  const byTerm: Record<string, BestRankCoverage> = {};
  const byTermAndGrade: Record<string, Record<string, BestRankCoverage>> = {};

  for (const [termId, rows] of rowsByTerm) {
    byTerm[termId] = bestRankCoverage(rows);

    const byGradeRows = new Map<
      string,
      { studentId: string; preferenceRank: number; leftover?: boolean }[]
    >();
    for (const row of rows) {
      const list = byGradeRows.get(row.gradeKey) ?? [];
      list.push({
        studentId: row.studentId,
        preferenceRank: row.preferenceRank,
        leftover: row.leftover,
      });
      byGradeRows.set(row.gradeKey, list);
    }

    const gradeMap: Record<string, BestRankCoverage> = {};
    for (const [gradeKey, gradeRows] of byGradeRows) {
      gradeMap[gradeKey] = bestRankCoverage(gradeRows);
    }
    byTermAndGrade[termId] = gradeMap;
  }

  return { byTerm, byTermAndGrade };
}

function aggregateMissingSeats(
  shortfalls: ElectiveSortResult["shortfalls"],
): { total: number; byGrade: MissingSeatsByGrade } {
  const byGrade: MissingSeatsByGrade = {};
  let total = 0;
  for (const s of shortfalls) {
    const missing = Math.max(0, s.required - s.assigned);
    total += missing;
    const key = gradeKeyOf(s.grade);
    const entry = byGrade[key] ?? { records: 0, missingSeats: 0 };
    entry.records += 1;
    entry.missingSeats += missing;
    byGrade[key] = entry;
  }
  return { total, byGrade };
}

function aggregateLeftovers(
  assignments: ElectiveAssignment[],
): { total: number; byGrade: Record<string, number> } {
  const byGrade: Record<string, number> = {};
  let total = 0;
  for (const a of assignments) {
    if (!a.leftover) continue;
    total += 1;
    const key = gradeKeyOf(a.grade);
    byGrade[key] = (byGrade[key] ?? 0) + 1;
  }
  return { total, byGrade };
}

function aggregateDisplacementMatrix(
  displacements: ElectiveSortResult["displacements"],
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const d of displacements) {
    const from = gradeKeyOf(d.displacedGrade);
    const to = gradeKeyOf(d.beneficiaryGrade);
    const row = matrix[from] ?? {};
    row[to] = (row[to] ?? 0) + 1;
    matrix[from] = row;
  }
  return matrix;
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

function printBestRankCoverage(coverage: BestRankCoverage, indent: string): void {
  const rankNums = Object.keys(coverage.ranks)
    .map(Number)
    .sort((a, b) => a - b);
  if (rankNums.length === 0) {
    console.log(`${indent}(no ranked assignments)`);
  } else {
    for (const r of rankNums) {
      const { studentsWith, pct } = coverage.ranks[r]!;
      console.log(
        `${indent}best = ${ordinal(r)} choice: ${studentsWith} student${studentsWith === 1 ? "" : "s"} (${pct.toFixed(1)}%)`,
      );
    }
  }
  if (coverage.leftoverOnlyStudents > 0) {
    console.log(
      `${indent}leftover-only: ${coverage.leftoverOnlyStudents} student${coverage.leftoverOnlyStudents === 1 ? "" : "s"}`,
    );
  }
}

function termLabel(term: ElectiveTerm): string {
  if (term.name) return `${term.name} (rank ${term.rank})`;
  return `Term rank ${term.rank}`;
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

/** Print the in-memory testsort report to stdout. */
export function printTestSortReport(report: TestSortReport): void {
  const {
    result,
    terms,
    missingSeatsTotal,
    missingSeatsByGrade,
    leftoverAssignments,
    leftoverByGrade,
    bestByGrade,
    bestByTerm,
    bestByTermAndGrade,
    courseSizeCountsByTerm,
    classSizeCounts,
    displacementMatrix,
    submissionNotes,
  } = report;

  console.log("\n========== testsort results (no DB writes) ==========");
  console.log(`Seed: ${result.seed}`);
  console.log(`Total assignments: ${result.assignments.length}`);
  console.log(`Courses with rosters: ${Object.keys(result.rosters).length}`);
  console.log(
    `Students with times_taken: ${Object.keys(result.timesTaken).length}`,
  );
  console.log(
    `Shortfall records: ${result.shortfalls.length} (${missingSeatsTotal} missing seat${missingSeatsTotal === 1 ? "" : "s"})`,
  );
  console.log(`Leftover (unranked) assignments: ${leftoverAssignments}`);
  console.log(`Displacements: ${result.displacements.length}`);

  console.log("\n--- Missing seats by grade ---");
  console.log("(missing seats = sum of required − assigned; records = shortfall rows)");
  const missKeys = sortGradeKeys(Object.keys(missingSeatsByGrade));
  if (missKeys.length === 0) {
    console.log("  (none)");
  } else {
    for (const key of missKeys) {
      const label = key === "null" ? "unknown" : key;
      const { records, missingSeats } = missingSeatsByGrade[key]!;
      console.log(
        `  Grade ${label}: ${missingSeats} missing seat${missingSeats === 1 ? "" : "s"} across ${records} record${records === 1 ? "" : "s"}`,
      );
    }
    console.log(`  Total missing seats: ${missingSeatsTotal}`);
  }

  console.log("\n--- Leftover (unranked) fills by grade ---");
  const leftoverKeys = sortGradeKeys(Object.keys(leftoverByGrade));
  if (leftoverKeys.length === 0) {
    console.log("  (none)");
  } else {
    for (const key of leftoverKeys) {
      const label = key === "null" ? "unknown" : key;
      const n = leftoverByGrade[key]!;
      console.log(`  Grade ${label}: ${n}`);
    }
  }

  if (result.displacements.length > 0) {
    console.log(`\n--- Displacements (${result.displacements.length} hops) ---`);
    console.log(
      "(same-grade preferred; older may bump younger; younger cannot bump older)",
    );
    console.log("  Matrix (displaced grade → beneficiary grade):");
    for (const from of sortGradeKeys(Object.keys(displacementMatrix))) {
      const row = displacementMatrix[from]!;
      const parts = sortGradeKeys(Object.keys(row)).map(
        (to) => `${to === "null" ? "?" : to}:${row[to]}`,
      );
      console.log(
        `    ${from === "null" ? "?" : from} → ${parts.join(", ")}`,
      );
    }
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

  console.log("\n--- Preference quality by grade (best assigned rank) ---");
  console.log(
    "(each student counted once by their best non-leftover seat; leftovers excluded)",
  );
  for (const gradeKey of sortGradeKeys(Object.keys(bestByGrade))) {
    const label = gradeKey === "null" ? "unknown" : gradeKey;
    const coverage = bestByGrade[gradeKey]!;
    console.log(
      `\nGrade ${label} — ${coverage.studentTotal} student(s) with seats, ${coverage.rankedStudentTotal} with ranked seats:`,
    );
    printBestRankCoverage(coverage, "  ");
  }

  console.log("\n--- Preference quality by term × grade ---");
  const orderedTerms = [...terms].sort((a, b) => a.rank - b.rank);
  for (const term of orderedTerms) {
    const coverage = bestByTerm[term.id];
    if (!coverage || coverage.studentTotal === 0) {
      console.log(`\n${termLabel(term)} — 0 student(s)`);
      continue;
    }
    console.log(
      `\n${termLabel(term)} — ${coverage.studentTotal} student(s), ${coverage.rankedStudentTotal} with ranked seats:`,
    );
    printBestRankCoverage(coverage, "  ");

    const byGradeInTerm = bestByTermAndGrade[term.id] ?? {};
    for (const gradeKey of sortGradeKeys(Object.keys(byGradeInTerm))) {
      const gradeLabel = gradeKey === "null" ? "unknown" : gradeKey;
      const gradeCoverage = byGradeInTerm[gradeKey]!;
      console.log(
        `  Grade ${gradeLabel} — ${gradeCoverage.studentTotal} student(s):`,
      );
      printBestRankCoverage(gradeCoverage, "    ");
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

/*
 * ---------------------------------------------------------------------------
 * LEGACY testsort reporting (commented out — unused)
 * Previously reported "share of students who received rank R as one of their
 * assigned classes" with a scaled count. Misleading for multi-seat quotas.
 * ---------------------------------------------------------------------------
 *
 * function coverageFromAssignments(...) { ... "studentsWith" scaling ... }
 * function aggregateByGrade(...) { ... }
 * function aggregateByTerm(...) { ... }
 */

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
  const { total: missingSeatsTotal, byGrade: missingSeatsByGrade } =
    aggregateMissingSeats(result.shortfalls);
  const { total: leftoverAssignments, byGrade: leftoverByGrade } =
    aggregateLeftovers(result.assignments);
  const bestByGrade = aggregateBestByGrade(result.assignments);
  const { byTerm: bestByTerm, byTermAndGrade: bestByTermAndGrade } =
    aggregateBestByTerm(result.assignments);
  const courseSizeCountsByTerm = aggregateCourseSizesByTerm(
    result.classFills,
    loaded.data.courses,
  );
  const classSizeCounts = aggregateClassSizes(result.classFills);
  const displacementMatrix = aggregateDisplacementMatrix(result.displacements);

  const report: TestSortReport = {
    result,
    terms: loaded.data.terms,
    missingSeatsTotal,
    missingSeatsByGrade,
    leftoverAssignments,
    leftoverByGrade,
    bestByGrade,
    bestByTerm,
    bestByTermAndGrade,
    courseSizeCountsByTerm,
    classSizeCounts,
    displacementMatrix,
    submissionNotes: notesLoaded.notes,
  };
  printTestSortReport(report);

  return { report };
}
