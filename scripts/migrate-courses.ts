import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

import { COURSES } from "../src/data/courses.ts";
import type { Database } from "../src/types/database.ts";

dotenv.config({
  path: ".env.local",
});

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Helper to get or create a school
async function getOrCreateSchool() {
  const schoolName = "Student Atlas High School";
  const { data: schools, error: fetchError } = await supabase
    .from("schools")
    .select("id")
    .eq("name", schoolName)
    .limit(1);

  if (fetchError) {
    console.error("Error fetching schools:", fetchError);
    throw fetchError;
  }

  if (schools && schools.length > 0) {
    console.log(`Using existing school: ${schools[0].id}`);
    return schools[0].id;
  }

  // Create a new school
  const { data: newSchool, error: insertError } = await supabase
    .from("schools")
    .insert({
      name: schoolName,
      website: "https://studentatlas.example.com",
      city: "San Francisco",
      state: "CA",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating school:", insertError);
    throw insertError;
  }

  console.log(`Created new school: ${newSchool.id}`);
  return newSchool.id;
}

// Helper to get or create departments for each subject
async function getOrCreateDepartments(schoolId: string) {
  const departmentMap = new Map<string, string>();

  // Get unique subjects from courses
  const subjects = Array.from(new Set(COURSES.map((c) => c.subject))).sort();

  console.log(`\nCreating departments for ${subjects.length} subjects...`);

  for (const subject of subjects) {
    // Check if department already exists
    const { data: existingDept, error: fetchError } = await supabase
      .from("departments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("name", subject)
      .limit(1);

    if (fetchError) {
      console.error(`Error fetching department ${subject}:`, fetchError);
      throw fetchError;
    }

    if (existingDept && existingDept.length > 0) {
      console.log(`Department already exists: ${subject} (${existingDept[0].id})`);
      departmentMap.set(subject, existingDept[0].id);
      continue;
    }

    // Create new department
    const { data: newDept, error: insertError } = await supabase
      .from("departments")
      .insert({
        school_id: schoolId,
        name: subject,
        code: subject.substring(0, 4).toUpperCase(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`Error creating department ${subject}:`, insertError);
      throw insertError;
    }

    console.log(`Created department: ${subject} (${newDept.id})`);
    departmentMap.set(subject, newDept.id);
  }

  return departmentMap;
}

// Helper to get or create terms
async function getOrCreateTerms(schoolId: string) {
  const termMap = new Map<string, string>();
  const currentYear = new Date().getFullYear();

  const terms = [
    { season: "fall", name: "Fall", year: currentYear },
    { season: "spring", name: "Spring", year: currentYear + 1 },
    { season: "both", name: "Fall & Spring", year: currentYear },
    { season: "all-year", name: "All Year", year: currentYear },
  ];

  console.log(`\nCreating terms...`);

  for (const termDef of terms) {
    // Check if term already exists
    const { data: existingTerm, error: fetchError } = await supabase
      .from("terms")
      .select("id")
      .eq("school_id", schoolId)
      .eq("season", termDef.season)
      .eq("year", termDef.year)
      .limit(1);

    if (fetchError) {
      console.error(`Error fetching term ${termDef.season}:`, fetchError);
      throw fetchError;
    }

    if (existingTerm && existingTerm.length > 0) {
      console.log(
        `Term already exists: ${termDef.name} ${termDef.year} (${existingTerm[0].id})`
      );
      termMap.set(termDef.season, existingTerm[0].id);
      continue;
    }

    // Create new term
    const { data: newTerm, error: insertError } = await supabase
      .from("terms")
      .insert({
        school_id: schoolId,
        name: `${termDef.name} ${termDef.year}`,
        season: termDef.season,
        year: termDef.year,
        start_date: null,
        end_date: null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error(`Error creating term ${termDef.season}:`, insertError);
      throw insertError;
    }

    console.log(
      `Created term: ${termDef.name} ${termDef.year} (${newTerm.id})`
    );
    termMap.set(termDef.season, newTerm.id);
  }

  return termMap;
}

// Helper to get or create teachers
async function getOrCreateTeacher(
  schoolId: string,
  teacherName: string | undefined,
) {
  if (!teacherName) return null;

  const [firstName, ...lastNameParts] = teacherName.split(" ");
  const lastName = lastNameParts.join(" ") || firstName;

  const { data: teachers, error: fetchError } = await supabase
    .from("teachers")
    .select("id")
    .eq("school_id", schoolId)
    .eq("first_name", firstName)
    .eq("last_name", lastName)
    .limit(1);

  if (fetchError) {
    console.error("Error fetching teachers:", fetchError);
    throw fetchError;
  }

  if (teachers && teachers.length > 0) {
    return teachers[0].id;
  }

  // Create a new teacher
  const { data: newTeacher, error: insertError } = await supabase
    .from("teachers")
    .insert({
      school_id: schoolId,
      first_name: firstName,
      last_name: lastName,
      email: null,
      department: null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating teacher:", insertError);
    throw insertError;
  }

  console.log(
    `Created new teacher: ${firstName} ${lastName} (${newTeacher.id})`,
  );
  return newTeacher.id;
}

// Get the representative grade for a course
function getRepresentativeGrade(grades: number[]): number {
  if (grades.length === 0) return 9; // Default to 9th grade
  return Math.min(...grades); // Use the lowest grade
}

// Migrate all courses
async function migrateCourses() {
  try {
    console.log("Starting course migration...");

    const schoolId = await getOrCreateSchool();
    const departmentMap = await getOrCreateDepartments(schoolId);
    const termMap = await getOrCreateTerms(schoolId);

    // Create a map of course titles to IDs (for handling prerequisites/corequisites)
    const courseMap = new Map<string, string>();

    // First pass: create all courses
    console.log("\n=== Creating courses ===");
    for (const course of COURSES) {
      // Get or create the teacher
      const teacherId = await getOrCreateTeacher(schoolId, course.teacher);

      // Get department and term IDs
      const departmentId = departmentMap.get(course.subject);
      const termId = termMap.get(course.term);

      // Check if course already exists
      const { data: existingCourse, error: fetchError } = await supabase
        .from("courses")
        .select("id")
        .eq("title", course.title)
        .eq("school_id", schoolId)
        .limit(1);

      if (fetchError) {
        console.error(`Error fetching course ${course.title}:`, fetchError);
        throw fetchError;
      }

      if (existingCourse && existingCourse.length > 0) {
        console.log(
          `Course already exists: ${course.title} (${existingCourse[0].id})`,
        );
        courseMap.set(course.title, existingCourse[0].id);
        continue;
      }

      // Insert the new course
      const { data: newCourse, error: insertError } = await supabase
        .from("courses")
        .insert({
          school_id: schoolId,
          title: course.title,
          subject: course.subject,
          short_description: course.shortDescription,
          long_description: course.longDescription,
          grade: getRepresentativeGrade(course.grades),
          term: course.term,
          teacher_id: teacherId,
          department_id: departmentId || null,
          term_id: termId || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`Error creating course ${course.title}:`, insertError);
        throw insertError;
      }

      console.log(`Created course: ${course.title} (${newCourse.id})`);
      courseMap.set(course.title, newCourse.id);
    }

    // Second pass: create prerequisite and corequisite relationships
    console.log("\n=== Creating prerequisites ===");
    for (const course of COURSES) {
      const courseId = courseMap.get(course.title);
      if (!courseId) {
        console.warn(`Course not found in map: ${course.title}`);
        continue;
      }

      // Create prerequisites
      for (const prerequisiteTitle of course.prerequisites) {
        const prerequisiteId = courseMap.get(prerequisiteTitle);
        if (!prerequisiteId) {
          console.warn(
            `Prerequisite course not found: ${prerequisiteTitle} for ${course.title}`,
          );
          continue;
        }

        // Check if prerequisite already exists
        const { data: existingPrereq, error: fetchError } = await supabase
          .from("course_prerequisites")
          .select("id")
          .eq("course_id", courseId)
          .eq("prerequisite_course_id", prerequisiteId)
          .limit(1);

        if (fetchError) {
          console.error(
            `Error fetching prerequisite for ${course.title}:`,
            fetchError,
          );
          throw fetchError;
        }

        if (existingPrereq && existingPrereq.length > 0) {
          console.log(
            `Prerequisite already exists: ${course.title} -> ${prerequisiteTitle}`,
          );
          continue;
        }

        const { error: insertError } = await supabase
          .from("course_prerequisites")
          .insert({
            course_id: courseId,
            prerequisite_course_id: prerequisiteId,
          });

        if (insertError) {
          console.error(
            `Error creating prerequisite ${prerequisiteTitle} for ${course.title}:`,
            insertError,
          );
          throw insertError;
        }

        console.log(
          `Created prerequisite: ${course.title} -> ${prerequisiteTitle}`,
        );
      }
    }

    // Third pass: create corequisites
    console.log("\n=== Creating corequisites ===");
    for (const course of COURSES) {
      const courseId = courseMap.get(course.title);
      if (!courseId) {
        console.warn(`Course not found in map: ${course.title}`);
        continue;
      }

      // Create corequisites
      for (const corequisiteTitle of course.corequisites) {
        const corequisiteId = courseMap.get(corequisiteTitle);
        if (!corequisiteId) {
          console.warn(
            `Corequisite course not found: ${corequisiteTitle} for ${course.title}`,
          );
          continue;
        }

        // Check if corequisite already exists
        const { data: existingCoreq, error: fetchError } = await supabase
          .from("course_corequisites")
          .select("id")
          .eq("course_id", courseId)
          .eq("corequisite_course_id", corequisiteId)
          .limit(1);

        if (fetchError) {
          console.error(
            `Error fetching corequisite for ${course.title}:`,
            fetchError,
          );
          throw fetchError;
        }

        if (existingCoreq && existingCoreq.length > 0) {
          console.log(
            `Corequisite already exists: ${course.title} <- -> ${corequisiteTitle}`,
          );
          continue;
        }

        const { error: insertError } = await supabase
          .from("course_corequisites")
          .insert({
            course_id: courseId,
            corequisite_course_id: corequisiteId,
          });

        if (insertError) {
          console.error(
            `Error creating corequisite ${corequisiteTitle} for ${course.title}:`,
            insertError,
          );
          throw insertError;
        }

        console.log(
          `Created corequisite: ${course.title} <- -> ${corequisiteTitle}`,
        );
      }
    }

    console.log(
      "\n✅ Migration completed successfully! All courses have been added to Supabase.",
    );
    console.log(`Total courses migrated: ${COURSES.length}`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Run the migration
migrateCourses();
