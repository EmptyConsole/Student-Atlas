-- The Nueva School — split "both" courses into Fall and Spring offerings
--
-- Run this once after the Nueva catalog import if courses with term = 'both'
-- should be represented as two separate course rows instead:
--   old "both" row -> new Fall row + new Spring row
--
-- The script is transactional. It preserves course data and copies dependent
-- references (bookmarks, notes, completed/enrolled/submitted courses,
-- graduation requirements, prerequisites, and corequisites) to the new rows
-- before deleting the old "both" course rows.

BEGIN;

DROP TABLE IF EXISTS _nueva_split_terms;
DROP TABLE IF EXISTS _nueva_both_course_map;

----------------------------------------------------------------------
-- 1. Resolve the Nueva school and Fall/Spring term IDs.
----------------------------------------------------------------------
CREATE TEMP TABLE _nueva_split_terms AS
SELECT
  s.id AS school_id,
  (
    SELECT t.id
    FROM terms t
    WHERE t.school_id = s.id
      AND t.season = 'fall'
    ORDER BY
      CASE WHEN t.name = 'Fall 2026' THEN 0 ELSE 1 END,
      t.year,
      t.name
    LIMIT 1
  ) AS fall_term_id,
  (
    SELECT t.id
    FROM terms t
    WHERE t.school_id = s.id
      AND t.season = 'spring'
    ORDER BY
      CASE WHEN t.name = 'Spring 2027' THEN 0 ELSE 1 END,
      t.year,
      t.name
    LIMIT 1
  ) AS spring_term_id
FROM schools s
WHERE s.name = 'The Nueva School';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _nueva_split_terms) THEN
    RAISE EXCEPTION 'The Nueva School was not found.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM _nueva_split_terms
    WHERE fall_term_id IS NULL OR spring_term_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Fall and Spring terms were not found for The Nueva School.';
  END IF;
END $$;

----------------------------------------------------------------------
-- 2. Build an old -> new ID map for every Nueva course marked "both".
----------------------------------------------------------------------
CREATE TEMP TABLE _nueva_both_course_map AS
SELECT
  c.id AS old_id,
  gen_random_uuid() AS fall_id,
  gen_random_uuid() AS spring_id
FROM courses c
JOIN _nueva_split_terms nt ON nt.school_id = c.school_id
WHERE c.term = 'both';

----------------------------------------------------------------------
-- 3. Insert cloned Fall/Spring courses.
----------------------------------------------------------------------
INSERT INTO courses (
  id,
  created_at,
  custom_coreq,
  custom_prereq,
  department_id,
  grade,
  long_description,
  or_coreq,
  or_prereq,
  retakeable,
  school_id,
  short_description,
  subject,
  teacher_id,
  term,
  term_id,
  title
)
SELECT
  m.fall_id,
  c.created_at,
  c.custom_coreq,
  c.custom_prereq,
  c.department_id,
  c.grade,
  c.long_description,
  c.or_coreq,
  c.or_prereq,
  c.retakeable,
  c.school_id,
  c.short_description,
  c.subject,
  c.teacher_id,
  'fall',
  nt.fall_term_id,
  c.title
FROM _nueva_both_course_map m
JOIN courses c ON c.id = m.old_id
JOIN _nueva_split_terms nt ON nt.school_id = c.school_id
UNION ALL
SELECT
  m.spring_id,
  c.created_at,
  c.custom_coreq,
  c.custom_prereq,
  c.department_id,
  c.grade,
  c.long_description,
  c.or_coreq,
  c.or_prereq,
  c.retakeable,
  c.school_id,
  c.short_description,
  c.subject,
  c.teacher_id,
  'spring',
  nt.spring_term_id,
  c.title
FROM _nueva_both_course_map m
JOIN courses c ON c.id = m.old_id
JOIN _nueva_split_terms nt ON nt.school_id = c.school_id;

----------------------------------------------------------------------
-- 4. Copy course-level dependent rows to both clones.
----------------------------------------------------------------------
INSERT INTO graduation_requirements (
  created_at,
  course_id,
  must_complete_before_graduation,
  must_complete_by_grade,
  recommended_grade,
  school_id
)
SELECT
  gr.created_at,
  v.new_id,
  gr.must_complete_before_graduation,
  gr.must_complete_by_grade,
  gr.recommended_grade,
  gr.school_id
FROM graduation_requirements gr
JOIN _nueva_both_course_map m ON m.old_id = gr.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM graduation_requirements existing
  WHERE existing.course_id = v.new_id
    AND existing.school_id = gr.school_id
);

----------------------------------------------------------------------
-- 5. Copy student-owned rows to both clones.
----------------------------------------------------------------------
INSERT INTO bookmarked_courses (created_at, student_id, course_id)
SELECT bc.created_at, bc.student_id, v.new_id
FROM bookmarked_courses bc
JOIN _nueva_both_course_map m ON m.old_id = bc.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM bookmarked_courses existing
  WHERE existing.student_id = bc.student_id
    AND existing.course_id = v.new_id
);

INSERT INTO completed_courses (created_at, student_id, course_id)
SELECT cc.created_at, cc.student_id, v.new_id
FROM completed_courses cc
JOIN _nueva_both_course_map m ON m.old_id = cc.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM completed_courses existing
  WHERE existing.student_id = cc.student_id
    AND existing.course_id = v.new_id
);

INSERT INTO enrolled_courses (created_at, student_id, course_id)
SELECT ec.created_at, ec.student_id, v.new_id
FROM enrolled_courses ec
JOIN _nueva_both_course_map m ON m.old_id = ec.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM enrolled_courses existing
  WHERE existing.student_id = ec.student_id
    AND existing.course_id = v.new_id
);

INSERT INTO course_notes (created_at, student_id, course_id, note)
SELECT cn.created_at, cn.student_id, v.new_id, cn.note
FROM course_notes cn
JOIN _nueva_both_course_map m ON m.old_id = cn.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM course_notes existing
  WHERE existing.student_id = cn.student_id
    AND existing.course_id = v.new_id
);

INSERT INTO submitted_courses (
  created_at,
  student_id,
  course_id,
  preference,
  submitted
)
SELECT
  sc.created_at,
  sc.student_id,
  v.new_id,
  sc.preference,
  sc.submitted
FROM submitted_courses sc
JOIN _nueva_both_course_map m ON m.old_id = sc.course_id
CROSS JOIN LATERAL (VALUES (m.fall_id), (m.spring_id)) AS v(new_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM submitted_courses existing
  WHERE existing.student_id = sc.student_id
    AND existing.course_id = v.new_id
);

----------------------------------------------------------------------
-- 6. Recreate prerequisite/corequisite links for cloned courses.
--    If the target requirement is also being split, Fall points at Fall and
--    Spring points at Spring. Otherwise the original target is reused.
----------------------------------------------------------------------
INSERT INTO course_prerequisites (
  created_at,
  course_id,
  prerequisite_course_id
)
SELECT
  cp.created_at,
  v.new_course_id,
  v.new_prerequisite_course_id
FROM course_prerequisites cp
JOIN _nueva_both_course_map course_map
  ON course_map.old_id = cp.course_id
LEFT JOIN _nueva_both_course_map prereq_map
  ON prereq_map.old_id = cp.prerequisite_course_id
CROSS JOIN LATERAL (
  VALUES
    (
      course_map.fall_id,
      COALESCE(prereq_map.fall_id, cp.prerequisite_course_id)
    ),
    (
      course_map.spring_id,
      COALESCE(prereq_map.spring_id, cp.prerequisite_course_id)
    )
) AS v(new_course_id, new_prerequisite_course_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM course_prerequisites existing
  WHERE existing.course_id = v.new_course_id
    AND existing.prerequisite_course_id = v.new_prerequisite_course_id
);

INSERT INTO course_corequisites (
  created_at,
  course_id,
  corequisite_course_id
)
SELECT
  cc.created_at,
  v.new_course_id,
  v.new_corequisite_course_id
FROM course_corequisites cc
JOIN _nueva_both_course_map course_map
  ON course_map.old_id = cc.course_id
LEFT JOIN _nueva_both_course_map coreq_map
  ON coreq_map.old_id = cc.corequisite_course_id
CROSS JOIN LATERAL (
  VALUES
    (
      course_map.fall_id,
      COALESCE(coreq_map.fall_id, cc.corequisite_course_id)
    ),
    (
      course_map.spring_id,
      COALESCE(coreq_map.spring_id, cc.corequisite_course_id)
    )
) AS v(new_course_id, new_corequisite_course_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM course_corequisites existing
  WHERE existing.course_id = v.new_course_id
    AND existing.corequisite_course_id = v.new_corequisite_course_id
);

----------------------------------------------------------------------
-- 7. Recreate inbound requirement links from non-split courses.
--    Fall courses point to the Fall copy; Spring courses point to the Spring
--    copy. All-year/other courses use the Fall copy to avoid duplicate titles
--    in the current app's requirement display.
----------------------------------------------------------------------
INSERT INTO course_prerequisites (
  created_at,
  course_id,
  prerequisite_course_id
)
SELECT
  cp.created_at,
  cp.course_id,
  CASE WHEN c.term = 'spring' THEN m.spring_id ELSE m.fall_id END
FROM course_prerequisites cp
JOIN courses c ON c.id = cp.course_id
JOIN _nueva_both_course_map m ON m.old_id = cp.prerequisite_course_id
WHERE NOT EXISTS (
  SELECT 1
  FROM _nueva_both_course_map split_course
  WHERE split_course.old_id = cp.course_id
)
AND NOT EXISTS (
  SELECT 1
  FROM course_prerequisites existing
  WHERE existing.course_id = cp.course_id
    AND existing.prerequisite_course_id =
      CASE WHEN c.term = 'spring' THEN m.spring_id ELSE m.fall_id END
);

INSERT INTO course_corequisites (
  created_at,
  course_id,
  corequisite_course_id
)
SELECT
  cc.created_at,
  cc.course_id,
  CASE WHEN c.term = 'spring' THEN m.spring_id ELSE m.fall_id END
FROM course_corequisites cc
JOIN courses c ON c.id = cc.course_id
JOIN _nueva_both_course_map m ON m.old_id = cc.corequisite_course_id
WHERE NOT EXISTS (
  SELECT 1
  FROM _nueva_both_course_map split_course
  WHERE split_course.old_id = cc.course_id
)
AND NOT EXISTS (
  SELECT 1
  FROM course_corequisites existing
  WHERE existing.course_id = cc.course_id
    AND existing.corequisite_course_id =
      CASE WHEN c.term = 'spring' THEN m.spring_id ELSE m.fall_id END
);

----------------------------------------------------------------------
-- 8. Delete rows that still reference the old "both" courses, then delete
--    the old courses.
----------------------------------------------------------------------
DELETE FROM course_prerequisites cp
USING _nueva_both_course_map m
WHERE cp.course_id = m.old_id
   OR cp.prerequisite_course_id = m.old_id;

DELETE FROM course_corequisites cc
USING _nueva_both_course_map m
WHERE cc.course_id = m.old_id
   OR cc.corequisite_course_id = m.old_id;

DELETE FROM graduation_requirements gr
USING _nueva_both_course_map m
WHERE gr.course_id = m.old_id;

DELETE FROM bookmarked_courses bc
USING _nueva_both_course_map m
WHERE bc.course_id = m.old_id;

DELETE FROM completed_courses cc
USING _nueva_both_course_map m
WHERE cc.course_id = m.old_id;

DELETE FROM enrolled_courses ec
USING _nueva_both_course_map m
WHERE ec.course_id = m.old_id;

DELETE FROM course_notes cn
USING _nueva_both_course_map m
WHERE cn.course_id = m.old_id;

DELETE FROM submitted_courses sc
USING _nueva_both_course_map m
WHERE sc.course_id = m.old_id;

DELETE FROM courses c
USING _nueva_both_course_map m
WHERE c.id = m.old_id;

----------------------------------------------------------------------
-- 9. Verification output. Supabase SQL Editor may show only the final result
--    set before COMMIT; zero remaining_both_courses means the conversion ran.
----------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM _nueva_both_course_map) AS split_course_count,
  (
    SELECT COUNT(*)
    FROM courses c
    JOIN _nueva_split_terms nt ON nt.school_id = c.school_id
    WHERE c.term = 'both'
  ) AS remaining_both_courses,
  (
    SELECT COUNT(*)
    FROM courses c
    JOIN _nueva_split_terms nt ON nt.school_id = c.school_id
    WHERE c.term IN ('fall', 'spring')
      AND EXISTS (
        SELECT 1
        FROM _nueva_both_course_map m
        WHERE c.id IN (m.fall_id, m.spring_id)
      )
  ) AS created_split_courses;

COMMIT;
