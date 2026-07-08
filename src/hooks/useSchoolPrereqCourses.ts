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

        // All courses belonging to this school, with their requirement arrays.
        const { data: schoolCourses, error: coursesError } = await supabase
          .from("courses")
          .select("id, title, prereq_options, coreq_options")
          .eq("school_id", id);

        if (coursesError) throw coursesError;

        const idToTitle = new Map(
          (schoolCourses ?? []).map((c) => [c.id, c.title]),
        );

        if (idToTitle.size === 0) {
          if (isMounted) {
            setCourseTitles([]);
            setError(null);
          }
          return;
        }

        // Collect every course UUID referenced inside any prereq/coreq array.
        const referencedIds = new Set<string>();
        for (const course of schoolCourses ?? []) {
          for (const arr of [course.prereq_options, course.coreq_options]) {
            for (const group of arr ?? []) {
              for (const element of group ?? []) {
                if (element != null && idToTitle.has(element)) {
                  referencedIds.add(element);
                }
              }
            }
          }
        }

        const titles = [
          ...new Set(
            [...referencedIds]
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
