/**
 * Bulk-loads school-scoped data for the elective sort algorithm.
 *
 * Every query is fenced to `schoolId`. Ranking rows whose student or course
 * is outside the school are dropped after fetch.
 *
 * PostgREST defaults to a 1000-row page size, so list queries are paginated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import { parseSchedule } from "../utils/classTime";
import type { ElectiveSortInput } from "../utils/electiveSort";

export type ElectiveClient = SupabaseClient<Database>;

export type LoadElectiveDataResult =
  | { data: ElectiveSortInput; error?: undefined }
  | { data?: undefined; error: string };

const PAGE_SIZE = 1000;

async function resolveClient(client?: ElectiveClient): Promise<ElectiveClient> {
  if (client) return client;
  // Lazy so Node CLI can inject a client without loading import.meta.env.
  const { supabase } = await import("./supabase");
  return supabase;
}

async function fetchAllRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error?: string }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) return { data: rows, error: error.message };
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return { data: rows };
}

/**
 * Fetch everything `runElectiveSort` needs for one school.
 * Pass a Node-side client from CLI scripts; the browser singleton is default.
 */
export async function loadElectiveData(
  schoolId: string,
  client?: ElectiveClient,
): Promise<LoadElectiveDataResult> {
  const db = await resolveClient(client);

  const [schoolRes, termsRes, studentsPage, coursesPage, rankingsPage] =
    await Promise.all([
      db
        .from("schools")
        .select("electives_assigned")
        .eq("id", schoolId)
        .maybeSingle(),
      db
        .from("terms")
        .select("id, name, position, created_at")
        .eq("school_id", schoolId)
        .order("position", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      fetchAllRows((from, to) =>
        db
          .from("students")
          .select("id, grade")
          .eq("school_id", schoolId)
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        db
          .from("courses")
          .select(
            "id, title, grade, term_options, schedule, max_student_count",
          )
          .eq("school_id", schoolId)
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        db
          .from("submitted_courses")
          .select(
            "student_id, course_id, preference, students!inner(school_id)",
          )
          .eq("submitted", true)
          .eq("students.school_id", schoolId)
          .range(from, to),
      ),
    ]);

  if (schoolRes.error) {
    return { error: schoolRes.error.message };
  }
  if (!schoolRes.data) {
    return { error: `School not found: ${schoolId}` };
  }
  if (termsRes.error) {
    return { error: termsRes.error.message };
  }
  if (studentsPage.error) {
    return { error: studentsPage.error };
  }
  if (coursesPage.error) {
    return { error: coursesPage.error };
  }
  if (rankingsPage.error) {
    return { error: rankingsPage.error };
  }

  const students = studentsPage.data.map((s) => ({
    id: s.id,
    grade: s.grade,
  }));
  const studentIds = new Set(students.map((s) => s.id));

  const courses = coursesPage.data.map((c) => ({
    id: c.id,
    title: c.title,
    grade: c.grade ?? null,
    termOptions: c.term_options ?? [],
    schedule: parseSchedule(c.schedule),
    maxStudentCount: c.max_student_count,
  }));
  const courseIds = new Set(courses.map((c) => c.id));

  const terms = (termsRes.data ?? []).map((t, index) => ({
    id: t.id,
    rank: index + 1,
    name: t.name,
  }));

  const rankings = rankingsPage.data
    .filter(
      (r) => studentIds.has(r.student_id) && courseIds.has(r.course_id),
    )
    .map((r) => ({
      studentId: r.student_id,
      courseId: r.course_id,
      preference: r.preference,
    }));

  return {
    data: {
      electivesAssigned: schoolRes.data.electives_assigned,
      terms,
      students,
      courses,
      rankings,
    },
  };
}
