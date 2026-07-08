import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Course, ReqGroup, ReqOptions } from "../data/courses";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses a stored prereq/coreq array (OR-of-AND groups of course UUIDs or free
 * text) into structured {@link ReqOptions}. UUID elements resolve to course
 * items via `idToTitle`; everything else (and any padding empty string) becomes
 * a free-text item / is dropped. Empty groups are removed.
 */
function parseRequirementOptions(
  raw: string[][] | null | undefined,
  idToTitle: Map<string, string>,
): ReqOptions {
  if (!raw) return [];
  const groups: ReqOptions = [];
  for (const group of raw) {
    if (!Array.isArray(group)) continue;
    const items: ReqGroup = [];
    for (const element of group) {
      if (element == null) continue;
      const value = String(element).trim();
      if (value === "") continue;
      if (UUID_RE.test(value)) {
        // Fall back to the raw id as title if unresolved so the item stays
        // unmet (never wrongly satisfied) rather than silently disappearing.
        const title = idToTitle.get(value) ?? value;
        items.push({ kind: "course", courseId: value, title });
      } else {
        items.push({ kind: "text", text: value });
      }
    }
    if (items.length > 0) groups.push(items);
  }
  return groups;
}

export function useCourses(schoolId: string | null) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setCourses([]);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchCourses(schoolId: string) {
      try {
        setLoading(true);
        setError(null);

        // Fetch all courses for this school
        const { data: supabaseCourses, error: coursesError } = await supabase
          .from("courses")
          .select("*")
          .eq("school_id", schoolId);

        if (coursesError) throw coursesError;
        if (!supabaseCourses || supabaseCourses.length === 0) {
          if (isMounted) {
            setCourses([]);
            setLoading(false);
          }
          return;
        }

        // Map every course id to its title so UUID references inside
        // prereq_options / coreq_options can be resolved to course items.
        const idToTitle = new Map<string, string>(
          supabaseCourses.map((c) => [c.id, c.title]),
        );

        // Step 4: Fetch teachers for all courses that have them
        const teacherIds = new Set<string>();
        supabaseCourses.forEach((c) => {
          if (c.teacher_id) teacherIds.add(c.teacher_id);
        });

        const teacherMap = new Map<string, string>();
        if (teacherIds.size > 0) {
          const { data: teachers, error: teachersError } = await supabase
            .from("teachers")
            .select("id, first_name, last_name")
            .in("id", Array.from(teacherIds));

          if (teachersError) throw teachersError;

          if (teachers) {
            teachers.forEach((t) => {
              const fullName = `${t.first_name} ${t.last_name}`.trim();
              teacherMap.set(t.id, fullName);
            });
          }
        }

        // Step 5: Transform supabase courses into app's Course type
        const transformedCourses: Course[] = supabaseCourses.map(
          (supabaseCourse) => {
            const prereqOptions = parseRequirementOptions(
              supabaseCourse.prereq_options,
              idToTitle,
            );
            const coreqOptions = parseRequirementOptions(
              supabaseCourse.coreq_options,
              idToTitle,
            );

            // Get teacher name if exists
            const teacher = supabaseCourse.teacher_id
              ? teacherMap.get(supabaseCourse.teacher_id)
              : undefined;

            return {
              id: supabaseCourse.id,
              subject: supabaseCourse.subject,
              title: supabaseCourse.title,
              grades: Array.isArray(supabaseCourse.grade)
                ? supabaseCourse.grade
                : [supabaseCourse.grade],
              prereqOptions,
              coreqOptions,
              teacher,
              retakeable: supabaseCourse.retakeable ?? false,
              term: supabaseCourse.term as
                | "fall"
                | "spring"
                | "both"
                | "all-year",
              shortDescription: supabaseCourse.short_description,
              longDescription: supabaseCourse.long_description,
            };
          },
        );

        if (isMounted) {
          setCourses(transformedCourses);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error ? err.message : "Failed to fetch courses";
          setError(message);
          setCourses([]);
          console.error("Error fetching courses:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchCourses(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  return { courses, loading, error };
}