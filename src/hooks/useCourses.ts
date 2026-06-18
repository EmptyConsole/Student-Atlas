import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Course } from "../data/courses";
import type { Tables } from "../types/database";

type SupabaseCourse = Tables<"courses">;

const SCHOOL_NAME = "Student Atlas High School";

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchCourses() {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Get the school ID
        const { data: schools, error: schoolError } = await supabase
          .from("schools")
          .select("id")
          .eq("name", SCHOOL_NAME)
          .limit(1);

        if (schoolError) throw schoolError;
        if (!schools || schools.length === 0) {
          throw new Error(`School "${SCHOOL_NAME}" not found in database`);
        }

        const schoolId = schools[0].id;

        // Step 2: Fetch all courses for this school
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

        // Step 3: For each course, fetch prerequisites and corequisites
        const courseMap = new Map<string, SupabaseCourse>();
        supabaseCourses.forEach((c) => courseMap.set(c.id, c));

        const prerequisiteMap = new Map<string, string[]>();
        const corequisiteMap = new Map<string, string[]>();

        // Fetch all prerequisites
        const { data: prerequisites, error: prereqError } = await supabase
          .from("course_prerequisites")
          .select("course_id, prerequisite_course_id");

        if (prereqError) throw prereqError;

        if (prerequisites) {
          for (const prereq of prerequisites) {
            if (!prerequisiteMap.has(prereq.course_id)) {
              prerequisiteMap.set(prereq.course_id, []);
            }
            prerequisiteMap
              .get(prereq.course_id)!
              .push(prereq.prerequisite_course_id);
          }
        }

        // Fetch all corequisites
        const { data: corequisites, error: coreqError } = await supabase
          .from("course_corequisites")
          .select("course_id, corequisite_course_id");

        if (coreqError) throw coreqError;

        if (corequisites) {
          for (const coreq of corequisites) {
            if (!corequisiteMap.has(coreq.course_id)) {
              corequisiteMap.set(coreq.course_id, []);
            }
            corequisiteMap
              .get(coreq.course_id)!
              .push(coreq.corequisite_course_id);
          }
        }

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
            // Get prerequisite course titles
            const prereqIds = prerequisiteMap.get(supabaseCourse.id) || [];
            const prerequisites: string[] = prereqIds
              .map((id) => courseMap.get(id)?.title)
              .filter((title): title is string => !!title);

            // Get corequisite course titles
            const coreqIds = corequisiteMap.get(supabaseCourse.id) || [];
            const corequisites: string[] = coreqIds
              .map((id) => courseMap.get(id)?.title)
              .filter((title): title is string => !!title);

            // Get teacher name if exists
            const teacher = supabaseCourse.teacher_id
              ? teacherMap.get(supabaseCourse.teacher_id)
              : undefined;

            return {
              id: supabaseCourse.id,
              subject: supabaseCourse.subject,
              title: supabaseCourse.title,
              grades: [supabaseCourse.grade],
              prerequisites,
              corequisites,
              teacher,
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

    fetchCourses();

    return () => {
      isMounted = false;
    };
  }, []);

  return { courses, loading, error };
}