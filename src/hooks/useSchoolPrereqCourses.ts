import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Returns the sorted, unique list of course titles that are referenced as a
 * prerequisite or corequisite by any course at the given school. This powers
 * the "Courses Taken" checklist on the profile page, scoped per school.
 */
export function useSchoolPrereqCourses(schoolId: string | null) {
  const [courseTitles, setCourseTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!schoolId) {
      setCourseTitles([]);
      setLoading(false);
      setError(null);
      return;
    }

    async function fetchPrereqCourses(id: string) {
      try {
        setLoading(true);
        setError(null);

        // All courses belonging to this school.
        const { data: schoolCourses, error: coursesError } = await supabase
          .from("courses")
          .select("id, title")
          .eq("school_id", id);

        if (coursesError) throw coursesError;

        const schoolCourseIds = (schoolCourses ?? []).map((c) => c.id);
        const idToTitle = new Map(
          (schoolCourses ?? []).map((c) => [c.id, c.title]),
        );

        if (schoolCourseIds.length === 0) {
          if (isMounted) {
            setCourseTitles([]);
            setError(null);
          }
          return;
        }

        // Prereq / coreq references made by this school's courses.
        const [prereqRes, coreqRes] = await Promise.all([
          supabase
            .from("course_prerequisites")
            .select("prerequisite_course_id")
            .in("course_id", schoolCourseIds),
          supabase
            .from("course_corequisites")
            .select("corequisite_course_id")
            .in("course_id", schoolCourseIds),
        ]);

        if (prereqRes.error) throw prereqRes.error;
        if (coreqRes.error) throw coreqRes.error;

        const referencedIds = [
          ...(prereqRes.data ?? []).map((r) => r.prerequisite_course_id),
          ...(coreqRes.data ?? []).map((r) => r.corequisite_course_id),
        ];

        const titles = [
          ...new Set(
            referencedIds
              .map((cid) => idToTitle.get(cid))
              .filter((t): t is string => !!t),
          ),
        ].sort((a, b) => a.localeCompare(b));

        if (isMounted) {
          setCourseTitles(titles);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to fetch prerequisite courses";
          setError(message);
          setCourseTitles([]);
          console.error("Error fetching prerequisite courses:", err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPrereqCourses(schoolId);

    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  return { courseTitles, loading, error };
}
