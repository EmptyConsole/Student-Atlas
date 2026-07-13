-- The Nueva School — migrate to the custom-term / term_options model
--
-- Self-contained, transactional migration that moves Nueva off the legacy
-- `courses.term` text enum and onto `courses.term_options` (an array of
-- `terms.id` uuids), and reduces Nueva to exactly two ordered term columns:
--   Fall 2026 (position 1) and Spring 2027 (position 2).
--
-- What it does:
--   1. Adds `terms.position` if missing.
--   2. Resolves Nueva's Fall/Spring term ids and sets their positions (1, 2).
--   3. Fills `term_options` from the legacy `term` value:
--        'fall'     -> {fall_id}
--        'spring'   -> {spring_id}
--        'all-year' -> {fall_id, spring_id}   (single spanning row)
--   4. Splits each 'both' course into two independent offerings: the existing
--      row becomes the Fall offering ({fall_id}); a cloned sibling row becomes
--      the Spring offering ({spring_id}), copying all course data and dependent
--      references (bookmarks, notes, completed/enrolled/submitted courses,
--      graduation requirements, prerequisites, corequisites).
--   5. Nulls out `term_id` on all affected Nueva courses.
--   6. Deletes every Nueva term row except Fall and Spring so the Register page
--      shows exactly two columns.
--
-- The legacy `courses.term` text column is intentionally left populated.

BEGIN;

DROP TABLE IF EXISTS _nueva_terms;
DROP TABLE IF EXISTS _nueva_both_map;

----------------------------------------------------------------------
-- 0. Ensure the ordering column exists.
----------------------------------------------------------------------
ALTER TABLE terms ADD COLUMN IF NOT EXISTS position smallint;

----------------------------------------------------------------------
-- 1. Resolve the Nueva school and its Fall/Spring term ids.
----------------------------------------------------------------------
CREATE TEMP TABLE _nueva_terms AS
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
  IF NOT EXISTS (SELECT 1 FROM _nueva_terms) THEN
    RAISE EXCEPTION 'The Nueva School was not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _nueva_terms WHERE fall_term_id IS NULL OR spring_term_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Fall and Spring terms were not found for The Nueva School.';
  END IF;
END $$;

----------------------------------------------------------------------
-- 2. Set term ordering: Fall = 1, Spring = 2.
----------------------------------------------------------------------
UPDATE terms t
SET position = 1
FROM _nueva_terms nt
WHERE t.id = nt.fall_term_id;

UPDATE terms t
SET position = 2
FROM _nueva_terms nt
WHERE t.id = nt.spring_term_id;

----------------------------------------------------------------------
-- 3. Fill term_options for single-term and all-year courses.
----------------------------------------------------------------------
UPDATE courses c
SET term_options = ARRAY[nt.fall_term_id]::uuid[]
FROM _nueva_terms nt
WHERE c.school_id = nt.school_id
  AND c.term = 'fall';

UPDATE courses c
SET term_options = ARRAY[nt.spring_term_id]::uuid[]
FROM _nueva_terms nt
WHERE c.school_id = nt.school_id
  AND c.term = 'spring';

UPDATE courses c
SET term_options = ARRAY[nt.fall_term_id, nt.spring_term_id]::uuid[]
FROM _nueva_terms nt
WHERE c.school_id = nt.school_id
  AND c.term = 'all-year';

----------------------------------------------------------------------
-- 4. Split 'both' courses: keep the existing row as the Fall offering and
--    add a cloned Spring sibling. Map old_id -> new spring_id.
----------------------------------------------------------------------
CREATE TEMP TABLE _nueva_both_map AS
SELECT
  c.id AS old_id,
  gen_random_uuid() AS spring_id
FROM courses c
JOIN _nueva_terms nt ON nt.school_id = c.school_id
WHERE c.term = 'both';

-- 4a. Insert the Spring clone (copies every course column).
INSERT INTO courses (
  id,
  created_at,
  custom_coreq,
  custom_prereq,
  department_id,
  grade,
  long_description,
  max_student_count,
  or_coreq,
  or_prereq,
  prereq_options,
  coreq_options,
  retakeable,
  school_id,
  short_description,
  subject,
  teacher_id,
  term,
  term_id,
  term_options,
  title
)
SELECT
  m.spring_id,
  c.created_at,
  c.custom_coreq,
  c.custom_prereq,
  c.department_id,
  c.grade,
  c.long_description,
  c.max_student_count,
  c.or_coreq,
  c.or_prereq,
  c.prereq_options,
  c.coreq_options,
  c.retakeable,
  c.school_id,
  c.short_description,
  c.subject,
  c.teacher_id,
  c.term,
  NULL,
  ARRAY[nt.spring_term_id]::uuid[],
  c.title
FROM _nueva_both_map m
JOIN courses c ON c.id = m.old_id
JOIN _nueva_terms nt ON nt.school_id = c.school_id;

-- 4b. Turn the original 'both' row into the Fall offering.
UPDATE courses c
SET term_options = ARRAY[nt.fall_term_id]::uuid[]
FROM _nueva_both_map m
JOIN _nueva_terms nt ON TRUE
WHERE c.id = m.old_id;

----------------------------------------------------------------------
-- 5. Copy dependent rows from the original ('both'/Fall) course to the new
--    Spring clone. Guards avoid duplicate rows on re-runs.
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
  m.spring_id,
  gr.must_complete_before_graduation,
  gr.must_complete_by_grade,
  gr.recommended_grade,
  gr.school_id
FROM graduation_requirements gr
JOIN _nueva_both_map m ON m.old_id = gr.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM graduation_requirements existing
  WHERE existing.course_id = m.spring_id
    AND existing.school_id = gr.school_id
);

INSERT INTO bookmarked_courses (created_at, student_id, course_id)
SELECT bc.created_at, bc.student_id, m.spring_id
FROM bookmarked_courses bc
JOIN _nueva_both_map m ON m.old_id = bc.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM bookmarked_courses existing
  WHERE existing.student_id = bc.student_id
    AND existing.course_id = m.spring_id
);

INSERT INTO completed_courses (created_at, student_id, course_id)
SELECT cc.created_at, cc.student_id, m.spring_id
FROM completed_courses cc
JOIN _nueva_both_map m ON m.old_id = cc.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM completed_courses existing
  WHERE existing.student_id = cc.student_id
    AND existing.course_id = m.spring_id
);

INSERT INTO enrolled_courses (created_at, student_id, course_id)
SELECT ec.created_at, ec.student_id, m.spring_id
FROM enrolled_courses ec
JOIN _nueva_both_map m ON m.old_id = ec.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM enrolled_courses existing
  WHERE existing.student_id = ec.student_id
    AND existing.course_id = m.spring_id
);

INSERT INTO course_notes (created_at, student_id, course_id, note)
SELECT cn.created_at, cn.student_id, m.spring_id, cn.note
FROM course_notes cn
JOIN _nueva_both_map m ON m.old_id = cn.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM course_notes existing
  WHERE existing.student_id = cn.student_id
    AND existing.course_id = m.spring_id
);

INSERT INTO submitted_courses (created_at, student_id, course_id, preference, submitted)
SELECT sc.created_at, sc.student_id, m.spring_id, sc.preference, sc.submitted
FROM submitted_courses sc
JOIN _nueva_both_map m ON m.old_id = sc.course_id
WHERE NOT EXISTS (
  SELECT 1 FROM submitted_courses existing
  WHERE existing.student_id = sc.student_id
    AND existing.course_id = m.spring_id
);

----------------------------------------------------------------------
-- 6. Recreate prerequisite/corequisite links for the Spring clone. When a
--    target course was itself split, the Spring clone points at the Spring
--    copy; otherwise it reuses the original target.
----------------------------------------------------------------------
INSERT INTO course_prerequisites (created_at, course_id, prerequisite_course_id)
SELECT
  cp.created_at,
  m.spring_id,
  COALESCE(target.spring_id, cp.prerequisite_course_id)
FROM course_prerequisites cp
JOIN _nueva_both_map m ON m.old_id = cp.course_id
LEFT JOIN _nueva_both_map target ON target.old_id = cp.prerequisite_course_id
WHERE NOT EXISTS (
  SELECT 1 FROM course_prerequisites existing
  WHERE existing.course_id = m.spring_id
    AND existing.prerequisite_course_id =
      COALESCE(target.spring_id, cp.prerequisite_course_id)
);

INSERT INTO course_corequisites (created_at, course_id, corequisite_course_id)
SELECT
  cc.created_at,
  m.spring_id,
  COALESCE(target.spring_id, cc.corequisite_course_id)
FROM course_corequisites cc
JOIN _nueva_both_map m ON m.old_id = cc.course_id
LEFT JOIN _nueva_both_map target ON target.old_id = cc.corequisite_course_id
WHERE NOT EXISTS (
  SELECT 1 FROM course_corequisites existing
  WHERE existing.course_id = m.spring_id
    AND existing.corequisite_course_id =
      COALESCE(target.spring_id, cc.corequisite_course_id)
);

----------------------------------------------------------------------
-- 7. Null out the legacy term_id on all affected Nueva courses (originals and
--    the new Spring clones already have NULL).
----------------------------------------------------------------------
UPDATE courses c
SET term_id = NULL
FROM _nueva_terms nt
WHERE c.school_id = nt.school_id
  AND c.term IN ('fall', 'spring', 'all-year', 'both');

----------------------------------------------------------------------
-- 8. Delete every Nueva term row except Fall and Spring so the Register page
--    renders exactly two columns.
----------------------------------------------------------------------
DELETE FROM terms t
USING _nueva_terms nt
WHERE t.school_id = nt.school_id
  AND t.id <> nt.fall_term_id
  AND t.id <> nt.spring_term_id;

----------------------------------------------------------------------
-- 9. Verification output.
----------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM _nueva_both_map) AS both_courses_split,
  (
    SELECT COUNT(*) FROM terms t
    JOIN _nueva_terms nt ON nt.school_id = t.school_id
  ) AS remaining_nueva_terms,
  (
    SELECT COUNT(*) FROM courses c
    JOIN _nueva_terms nt ON nt.school_id = c.school_id
    WHERE c.term_options IS NULL OR cardinality(c.term_options) = 0
  ) AS courses_missing_term_options;

COMMIT;
