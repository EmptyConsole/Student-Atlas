-- test2 School — large seed for the quarter / term_options data model
--
-- Creates a school called "test2" in Spider, Man with FOUR quarter terms,
-- 17 unevenly sized departments, and 300 course rows. Students rank 8 courses
-- per quarter (schools.rankings = 8).
--
-- Term shapes (each appears at least twice):
--   * single-quarter          {Q1} | {Q2} | {Q3} | {Q4}
--   * two-quarter spanning    {Q1,Q2} | {Q2,Q3} | {Q3,Q4}
--   * three-quarter spanning  {Q1,Q2,Q3} | {Q2,Q3,Q4}
--   * full-year spanning      {Q1,Q2,Q3,Q4}
--   * independent offerings   multiple rows, same title/signature, different
--                             single-quarter term_options (app merges into
--                             one card with an offering picker)
--
-- Prerequisites/corequisites live on courses.prereq_options / coreq_options as
-- text[][] in disjunctive normal form (outer = OR-groups, inner = AND-groups;
-- each element is a course UUID as text OR free text). Postgres arrays must be
-- rectangular, so mixed-length AND-groups are padded with '' (ignored by the app).
-- Every prereq/coreq shape below appears at least twice:
--   * none
--   * single UUID
--   * single free-text
--   * two UUIDs AND
--   * UUID OR free-text
--   * UUID OR UUID
--   * uneven AND-groups (padded '')
--   * UUID coreq / free-text coreq / AND coreq / OR coreq
--   * prereq + coreq combined
--
-- Every logical course has a distinct teacher. Independent-offering rows that
-- must share a signature (including teacher) intentionally reuse that teacher
-- so the app can group them.
--
-- Fixed UUIDs are used for the school, terms, and departments. Re-running will
-- conflict on primary keys; delete the test2 school first if you need a reset.

BEGIN;

----------------------------------------------------------------------
-- 1. School
----------------------------------------------------------------------
INSERT INTO schools (id, name, website, city, state, password, rankings)
VALUES (
  'a2b20000-0000-4000-a000-000000000000',
  'test2',
  'https://test2.example.edu',
  'Spider',
  'Man',
  'test2123',
  8
);

----------------------------------------------------------------------
-- 2. Terms (four quarters, ordered by position)
----------------------------------------------------------------------
INSERT INTO terms (id, school_id, name, position) VALUES
  ('a2b21111-0000-4000-a000-000000000001', 'a2b20000-0000-4000-a000-000000000000', 'Quarter 1', 1),
  ('a2b21111-0000-4000-a000-000000000002', 'a2b20000-0000-4000-a000-000000000000', 'Quarter 2', 2),
  ('a2b21111-0000-4000-a000-000000000003', 'a2b20000-0000-4000-a000-000000000000', 'Quarter 3', 3),
  ('a2b21111-0000-4000-a000-000000000004', 'a2b20000-0000-4000-a000-000000000000', 'Quarter 4', 4);

----------------------------------------------------------------------
-- 3. Departments (17 total; course counts are intentionally skewed)
----------------------------------------------------------------------
INSERT INTO departments (id, school_id, name, code, graduation_requirement, subtitle) VALUES
  ('a2b22222-0000-4000-a000-000000000001', 'a2b20000-0000-4000-a000-000000000000', 'Mathematics',       'MATH', '3 years required',  'Quantitative reasoning across four quarters.'),
  ('a2b22222-0000-4000-a000-000000000002', 'a2b20000-0000-4000-a000-000000000000', 'English',           'ENG',  '4 years required',  'Literature, rhetoric, and composition.'),
  ('a2b22222-0000-4000-a000-000000000003', 'a2b20000-0000-4000-a000-000000000000', 'Science',           'SCI',  '3 years required',  'Laboratory science and inquiry.'),
  ('a2b22222-0000-4000-a000-000000000004', 'a2b20000-0000-4000-a000-000000000000', 'Computer Science',  'CS',   'Elective',          'Programming, systems, and data.'),
  ('a2b22222-0000-4000-a000-000000000005', 'a2b20000-0000-4000-a000-000000000000', 'History',           'HIST', '3 years required',  'History of societies and ideas.'),
  ('a2b22222-0000-4000-a000-000000000006', 'a2b20000-0000-4000-a000-000000000000', 'World Languages',   'WL',   '2 years required',  'Modern and classical languages.'),
  ('a2b22222-0000-4000-a000-000000000007', 'a2b20000-0000-4000-a000-000000000000', 'Arts',              'ARTS', '1 year required',   'Visual arts and design.'),
  ('a2b22222-0000-4000-a000-000000000008', 'a2b20000-0000-4000-a000-000000000000', 'Physical Education','PE',   '2 years required',  'Movement, fitness, and wellness.'),
  ('a2b22222-0000-4000-a000-000000000009', 'a2b20000-0000-4000-a000-000000000000', 'Social Sciences',   'SS',   'Elective',          'Civics, economics, and society.'),
  ('a2b22222-0000-4000-a000-000000000010', 'a2b20000-0000-4000-a000-000000000000', 'Engineering',       'ENGIN','Elective',          'Design, build, and iterate.'),
  ('a2b22222-0000-4000-a000-000000000011', 'a2b20000-0000-4000-a000-000000000000', 'Music',             'MUS',  'Elective',          'Performance and musicianship.'),
  ('a2b22222-0000-4000-a000-000000000012', 'a2b20000-0000-4000-a000-000000000000', 'Theater',           'THTR', 'Elective',          'Performance and production.'),
  ('a2b22222-0000-4000-a000-000000000013', 'a2b20000-0000-4000-a000-000000000000', 'Business',          'BUS',  'Elective',          'Entrepreneurship and markets.'),
  ('a2b22222-0000-4000-a000-000000000014', 'a2b20000-0000-4000-a000-000000000000', 'Media Studies',     'MEDIA','Elective',          'Film, journalism, and digital media.'),
  ('a2b22222-0000-4000-a000-000000000015', 'a2b20000-0000-4000-a000-000000000000', 'Philosophy',        'PHIL', 'Elective',          'Ethics, logic, and inquiry.'),
  ('a2b22222-0000-4000-a000-000000000016', 'a2b20000-0000-4000-a000-000000000000', 'Health',            'HLTH', '1 semester required','Personal and community health.'),
  ('a2b22222-0000-4000-a000-000000000017', 'a2b20000-0000-4000-a000-000000000000', 'Debate',            'DEB',  'Elective',          'Argumentation and public speaking.');

----------------------------------------------------------------------
-- 4. Procedural catalog: teachers + 300 courses + requirement patterns
----------------------------------------------------------------------
DO $seed$
DECLARE
  v_school uuid := 'a2b20000-0000-4000-a000-000000000000';
  v_q1 uuid := 'a2b21111-0000-4000-a000-000000000001';
  v_q2 uuid := 'a2b21111-0000-4000-a000-000000000002';
  v_q3 uuid := 'a2b21111-0000-4000-a000-000000000003';
  v_q4 uuid := 'a2b21111-0000-4000-a000-000000000004';

  -- Uneven department sizes (sum = 300)
  v_dept_ids uuid[] := ARRAY[
    'a2b22222-0000-4000-a000-000000000001'::uuid, -- Math 48
    'a2b22222-0000-4000-a000-000000000002'::uuid, -- English 40
    'a2b22222-0000-4000-a000-000000000003'::uuid, -- Science 35
    'a2b22222-0000-4000-a000-000000000004'::uuid, -- CS 28
    'a2b22222-0000-4000-a000-000000000005'::uuid, -- History 24
    'a2b22222-0000-4000-a000-000000000006'::uuid, -- WL 20
    'a2b22222-0000-4000-a000-000000000007'::uuid, -- Arts 18
    'a2b22222-0000-4000-a000-000000000008'::uuid, -- PE 15
    'a2b22222-0000-4000-a000-000000000009'::uuid, -- SS 14
    'a2b22222-0000-4000-a000-000000000010'::uuid, -- Engineering 12
    'a2b22222-0000-4000-a000-000000000011'::uuid, -- Music 10
    'a2b22222-0000-4000-a000-000000000012'::uuid, -- Theater 8
    'a2b22222-0000-4000-a000-000000000013'::uuid, -- Business 7
    'a2b22222-0000-4000-a000-000000000014'::uuid, -- Media 6
    'a2b22222-0000-4000-a000-000000000015'::uuid, -- Philosophy 5
    'a2b22222-0000-4000-a000-000000000016'::uuid, -- Health 5
    'a2b22222-0000-4000-a000-000000000017'::uuid  -- Debate 5
  ];
  v_dept_sizes int[] := ARRAY[48,40,35,28,24,20,18,15,14,12,10,8,7,6,5,5,5];
  v_dept_names text[] := ARRAY[
    'Mathematics','English','Science','Computer Science','History',
    'World Languages','Arts','Physical Education','Social Sciences','Engineering',
    'Music','Theater','Business','Media Studies','Philosophy','Health','Debate'
  ];

  v_first_names text[] := ARRAY[
    'Ava','Noah','Mia','Liam','Zoe','Ethan','Iris','Owen','Nora','Caleb',
    'Lila','Kai','Elena','Marco','Sofia','Riley','Jade','Miles','Aria','Quinn',
    'Harper','Felix','Vera','Jonah','Nina','Asher','Chloe','Leo','Maya','Dean'
  ];
  v_last_names text[] := ARRAY[
    'Nguyen','Patel','Garcia','Kim','Rossi','Okoye','Brooks','Hassan','Li','Torres',
    'Andersen','Dubois','Singh','Cohen','Nakamura','Ali','Perez','Walsh','Berg','Diaz',
    'Costa','Murphy','Tanaka','Reed','Khan','Ibrahim','Novak','Chen','Foster','Sato'
  ];

  v_course_id uuid;
  v_teacher_id uuid;
  v_dept_id uuid;
  v_dept_name text;
  v_title text;
  v_short text;
  v_long text;
  v_grades int[];
  v_term_opts uuid[];
  v_max smallint;
  v_retakeable boolean;
  v_seq int := 0;
  v_dept_idx int;
  v_local int;
  v_pattern_idx int;
  v_id1 uuid; v_id2 uuid; v_id3 uuid; v_id4 uuid;
  v_t_shared uuid;
  i int;
  j int;
BEGIN
  CREATE TEMP TABLE _t2_courses (
    seq int PRIMARY KEY,
    id uuid NOT NULL,
    department_id uuid NOT NULL,
    subject text NOT NULL,
    title text NOT NULL,
    is_foundation boolean NOT NULL DEFAULT false,
    is_independent_clone boolean NOT NULL DEFAULT false
  ) ON COMMIT DROP;

  ------------------------------------------------------------------
  -- 4a. Insert base course rows (including two copies of each
  --     independent-offering title so total rows = 300)
  ------------------------------------------------------------------
  FOR v_dept_idx IN 1..17 LOOP
    v_dept_id := v_dept_ids[v_dept_idx];
    v_dept_name := v_dept_names[v_dept_idx];

    FOR v_local IN 1..v_dept_sizes[v_dept_idx] LOOP
      v_seq := v_seq + 1;

      -- Unique teacher per logical course row (shared later only for clones).
      v_teacher_id := gen_random_uuid();
      INSERT INTO teachers (id, school_id, first_name, last_name, email, department)
      VALUES (
        v_teacher_id,
        v_school,
        v_first_names[1 + ((v_seq - 1) % array_length(v_first_names, 1))],
        v_last_names[1 + ((v_seq * 7 - 1) % array_length(v_last_names, 1))],
        format('t%03d@test2.example.edu', v_seq),
        v_dept_name
      );

      v_course_id := gen_random_uuid();

      -- Rotate through all 10 single/spanning term shapes (each many times).
      -- Independent multi-row offerings are applied later and override these.
      v_pattern_idx := ((v_seq - 1) % 10) + 1;
      v_term_opts := CASE v_pattern_idx
        WHEN 1 THEN ARRAY[v_q1]
        WHEN 2 THEN ARRAY[v_q2]
        WHEN 3 THEN ARRAY[v_q3]
        WHEN 4 THEN ARRAY[v_q4]
        WHEN 5 THEN ARRAY[v_q1, v_q2]
        WHEN 6 THEN ARRAY[v_q2, v_q3]
        WHEN 7 THEN ARRAY[v_q3, v_q4]
        WHEN 8 THEN ARRAY[v_q1, v_q2, v_q3]
        WHEN 9 THEN ARRAY[v_q2, v_q3, v_q4]
        ELSE ARRAY[v_q1, v_q2, v_q3, v_q4]
      END;

      -- Title / copy
      v_title := format('%s %s', v_dept_name, lpad(v_local::text, 2, '0'));
      v_short := format('%s topic %s.', v_dept_name, v_local);
      v_long := format(
        'Quarter-based %s course covering unit %s with labs, projects, and discussion.',
        lower(v_dept_name), v_local
      );

      -- Grade bands cycle
      CASE ((v_local - 1) % 5)
        WHEN 0 THEN v_grades := ARRAY[9];
        WHEN 1 THEN v_grades := ARRAY[9, 10];
        WHEN 2 THEN v_grades := ARRAY[10, 11];
        WHEN 3 THEN v_grades := ARRAY[11, 12];
        ELSE        v_grades := ARRAY[9, 10, 11, 12];
      END CASE;

      v_max := (12 + (v_seq % 20))::smallint;
      v_retakeable := (v_seq % 11 = 0);

      -- Mark first two courses in the largest departments as foundations for
      -- later prereq references.
      INSERT INTO courses (
        id, title, short_description, long_description, grade, term, subject,
        school_id, teacher_id, department_id, retakeable, prereq_options,
        coreq_options, max_student_count, term_options
      ) VALUES (
        v_course_id, v_title, v_short, v_long, v_grades, '', v_dept_name,
        v_school, v_teacher_id, v_dept_id, v_retakeable, NULL, NULL, v_max,
        v_term_opts
      );

      INSERT INTO _t2_courses (seq, id, department_id, subject, title, is_foundation)
      VALUES (
        v_seq, v_course_id, v_dept_id, v_dept_name, v_title,
        (v_dept_idx <= 5 AND v_local <= 2)
      );
    END LOOP;
  END LOOP;

  IF v_seq <> 300 THEN
    RAISE EXCEPTION 'Expected 300 courses, got %', v_seq;
  END IF;

  ------------------------------------------------------------------
  -- 4b. Independent offerings (at least two groups of each flavor):
  --     * two rows, same signature, different single quarters (x4 groups)
  --     * three rows across three quarters (x2 groups)
  --     Implemented by overwriting term_options on reserved courses and
  --     cloning signature fields (including teacher) onto partners.
  --
  -- Reserved seq blocks near the end of large departments so we do not
  -- disturb the foundation courses used for prereqs.
  ------------------------------------------------------------------

  -- Helper inline: turn courses at seq A into independent offerings that
  -- match course B's signature except term_options.
  -- Pair groups (2 offerings each) — four distinct pairs => pattern x2+.
  FOR i IN 1..4 LOOP
    -- Primary: seq 251–254; partner: seq 261–264
    SELECT id INTO v_id1 FROM _t2_courses WHERE seq = 250 + i;
    SELECT id INTO v_id2 FROM _t2_courses WHERE seq = 260 + i;

    SELECT teacher_id INTO v_t_shared FROM courses WHERE id = v_id1;

    -- Align partner to primary signature (except id + term_options).
    UPDATE courses p
    SET title = c.title,
        short_description = c.short_description,
        long_description = c.long_description,
        grade = c.grade,
        subject = c.subject,
        department_id = c.department_id,
        teacher_id = v_t_shared,
        retakeable = c.retakeable,
        max_student_count = c.max_student_count,
        prereq_options = NULL,
        coreq_options = NULL,
        term_options = CASE i
          WHEN 1 THEN ARRAY[v_q2]
          WHEN 2 THEN ARRAY[v_q3]
          WHEN 3 THEN ARRAY[v_q4]
          ELSE ARRAY[v_q1]
        END
    FROM courses c
    WHERE c.id = v_id1 AND p.id = v_id2;

    UPDATE courses
    SET term_options = CASE i
          WHEN 1 THEN ARRAY[v_q1]
          WHEN 2 THEN ARRAY[v_q1]
          WHEN 3 THEN ARRAY[v_q2]
          ELSE ARRAY[v_q3]
        END,
        prereq_options = NULL,
        coreq_options = NULL
    WHERE id = v_id1;

    UPDATE _t2_courses SET title = (SELECT title FROM courses WHERE id = v_id1), is_independent_clone = false WHERE id = v_id1;
    UPDATE _t2_courses SET title = (SELECT title FROM courses WHERE id = v_id1), is_independent_clone = true WHERE id = v_id2;
  END LOOP;

  -- Triple independent offerings (two groups).
  FOR i IN 1..2 LOOP
    SELECT id INTO v_id1 FROM _t2_courses WHERE seq = 270 + (i - 1) * 3;
    SELECT id INTO v_id2 FROM _t2_courses WHERE seq = 271 + (i - 1) * 3;
    SELECT id INTO v_id3 FROM _t2_courses WHERE seq = 272 + (i - 1) * 3;
    SELECT teacher_id INTO v_t_shared FROM courses WHERE id = v_id1;

    UPDATE courses
    SET term_options = ARRAY[v_q1], prereq_options = NULL, coreq_options = NULL
    WHERE id = v_id1;

    UPDATE courses p
    SET title = c.title,
        short_description = c.short_description,
        long_description = c.long_description,
        grade = c.grade,
        subject = c.subject,
        department_id = c.department_id,
        teacher_id = v_t_shared,
        retakeable = true,
        max_student_count = c.max_student_count,
        prereq_options = NULL,
        coreq_options = NULL,
        term_options = ARRAY[v_q2]
    FROM courses c
    WHERE c.id = v_id1 AND p.id = v_id2;

    UPDATE courses p
    SET title = c.title,
        short_description = c.short_description,
        long_description = c.long_description,
        grade = c.grade,
        subject = c.subject,
        department_id = c.department_id,
        teacher_id = v_t_shared,
        retakeable = true,
        max_student_count = c.max_student_count,
        prereq_options = NULL,
        coreq_options = NULL,
        term_options = ARRAY[v_q3]
    FROM courses c
    WHERE c.id = v_id1 AND p.id = v_id3;

    UPDATE courses SET retakeable = true WHERE id = v_id1;

    UPDATE _t2_courses SET is_independent_clone = false WHERE id = v_id1;
    UPDATE _t2_courses SET title = (SELECT title FROM courses WHERE id = v_id1), is_independent_clone = true WHERE id IN (v_id2, v_id3);
  END LOOP;

  -- Independent clones share a teacher; remove teachers no longer referenced.
  DELETE FROM teachers t
  WHERE t.school_id = v_school
    AND t.id NOT IN (
      SELECT teacher_id FROM courses
      WHERE school_id = v_school AND teacher_id IS NOT NULL
    );

  ------------------------------------------------------------------
  -- 4c. Prereq / coreq variation (each shape at least twice).
  --     Foundations (first two in Math/English/Science/CS/History) are
  --     the reusable UUID targets.
  ------------------------------------------------------------------
  SELECT id INTO v_id1 FROM _t2_courses WHERE seq = 1;  -- Math 01
  SELECT id INTO v_id2 FROM _t2_courses WHERE seq = 2;  -- Math 02
  SELECT id INTO v_id3 FROM _t2_courses WHERE seq = 49; -- English 01
  SELECT id INTO v_id4 FROM _t2_courses WHERE seq = 89; -- Science 01

  -- Clear requirements on foundations themselves.
  UPDATE courses
  SET prereq_options = NULL, coreq_options = NULL
  WHERE id IN (v_id1, v_id2, v_id3, v_id4);

  -- Shape helpers applied to dedicated seqs (avoid independent-offering rows).
  -- 1) none — default on most rows; reinforce on seq 3,4
  UPDATE courses SET prereq_options = NULL, coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (3, 4));

  -- 2) single UUID prereq (x2+)
  UPDATE courses SET prereq_options = ARRAY[ARRAY[v_id1::text]], coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (5, 6));

  -- 3) single free-text prereq (x2+)
  UPDATE courses SET prereq_options = ARRAY[ARRAY['Instructor permission']], coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (7, 8));

  -- 4) two UUIDs AND prereq (x2+)
  UPDATE courses SET prereq_options = ARRAY[ARRAY[v_id1::text, v_id2::text]], coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (9, 10));

  -- 5) UUID OR free-text prereq (x2+)
  UPDATE courses SET prereq_options = ARRAY[ARRAY[v_id1::text], ARRAY['Placement test']], coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (11, 12));

  -- 6) UUID OR UUID prereq (x2+)
  UPDATE courses SET prereq_options = ARRAY[ARRAY[v_id1::text], ARRAY[v_id3::text]], coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (13, 14));

  -- 7) uneven AND-groups padded with '' (x2+)
  UPDATE courses SET
    prereq_options = ARRAY[
      ARRAY[v_id1::text, v_id2::text],
      ARRAY[v_id3::text, '']
    ],
    coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (15, 16));

  -- 8) single UUID coreq only (x2+)
  UPDATE courses SET prereq_options = NULL, coreq_options = ARRAY[ARRAY[v_id1::text]]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (17, 18));

  -- 9) free-text coreq only (x2+)
  UPDATE courses SET prereq_options = NULL,
    coreq_options = ARRAY[ARRAY['Concurrent enrollment in a math course']]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (19, 20));

  -- 10) two UUIDs AND coreq (x2+)
  UPDATE courses SET prereq_options = NULL,
    coreq_options = ARRAY[ARRAY[v_id1::text, v_id3::text]]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (21, 22));

  -- 11) OR coreq groups (x2+)
  UPDATE courses SET prereq_options = NULL,
    coreq_options = ARRAY[ARRAY[v_id2::text], ARRAY['Lab section required']]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (23, 24));

  -- 12) UUID prereq + UUID coreq (x2+)
  UPDATE courses SET
    prereq_options = ARRAY[ARRAY[v_id1::text]],
    coreq_options = ARRAY[ARRAY[v_id3::text]]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (25, 26));

  -- 13) UUID prereq + free-text coreq (x2+)
  UPDATE courses SET
    prereq_options = ARRAY[ARRAY[v_id4::text]],
    coreq_options = ARRAY[ARRAY['Ability to read music or instructor approval']]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (27, 28));

  -- 14) complex multi-OR prereq + AND coreq (x2+)
  UPDATE courses SET
    prereq_options = ARRAY[
      ARRAY[v_id1::text, v_id2::text],
      ARRAY[v_id3::text, ''],
      ARRAY['Department approval']
    ],
    coreq_options = ARRAY[ARRAY[v_id4::text, v_id1::text]]
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (29, 30));

  -- 15) free-text-only AND group prereq (x2+)
  UPDATE courses SET
    prereq_options = ARRAY[ARRAY['Successful completion of a placement exam', 'Counselor recommendation']],
    coreq_options = NULL
  WHERE id IN (SELECT id FROM _t2_courses WHERE seq IN (31, 32));

  -- Spread additional realistic requirements across remaining Math/CS/Science
  -- courses so the catalog is not mostly empty after the guaranteed samples.
  FOR j IN 33..120 LOOP
    -- skip independent clones
    IF EXISTS (SELECT 1 FROM _t2_courses WHERE seq = j AND is_independent_clone) THEN
      CONTINUE;
    END IF;

    CASE (j % 7)
      WHEN 0 THEN
        UPDATE courses SET
          prereq_options = ARRAY[ARRAY[v_id1::text]],
          coreq_options = NULL
        WHERE id = (SELECT id FROM _t2_courses WHERE seq = j);
      WHEN 1 THEN
        UPDATE courses SET
          prereq_options = ARRAY[ARRAY[v_id2::text], ARRAY['Instructor permission']],
          coreq_options = NULL
        WHERE id = (SELECT id FROM _t2_courses WHERE seq = j);
      WHEN 2 THEN
        UPDATE courses SET
          prereq_options = NULL,
          coreq_options = ARRAY[ARRAY[v_id3::text]]
        WHERE id = (SELECT id FROM _t2_courses WHERE seq = j);
      WHEN 3 THEN
        UPDATE courses SET
          prereq_options = ARRAY[ARRAY[v_id1::text, v_id4::text]],
          coreq_options = ARRAY[ARRAY['Concurrent enrollment in a writing seminar']]
        WHERE id = (SELECT id FROM _t2_courses WHERE seq = j);
      WHEN 4 THEN
        UPDATE courses SET
          prereq_options = ARRAY[ARRAY[v_id3::text]],
          coreq_options = ARRAY[ARRAY[v_id2::text]]
        WHERE id = (SELECT id FROM _t2_courses WHERE seq = j);
      ELSE
        NULL; -- leave none
    END CASE;
  END LOOP;

  ------------------------------------------------------------------
  -- 4d. A few graduation requirements on foundations
  ------------------------------------------------------------------
  INSERT INTO graduation_requirements (
    school_id, course_id, must_complete_by_grade, must_complete_before_graduation, recommended_grade
  )
  SELECT v_school, id, 10, true, 9
  FROM _t2_courses
  WHERE is_foundation;
END;
$seed$;

----------------------------------------------------------------------
-- 5. Verification
----------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM terms       WHERE school_id = 'a2b20000-0000-4000-a000-000000000000') AS terms,
  (SELECT COUNT(*) FROM departments WHERE school_id = 'a2b20000-0000-4000-a000-000000000000') AS departments,
  (SELECT COUNT(*) FROM teachers    WHERE school_id = 'a2b20000-0000-4000-a000-000000000000') AS teachers,
  (SELECT COUNT(*) FROM courses     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000') AS courses,
  (SELECT rankings FROM schools WHERE id = 'a2b20000-0000-4000-a000-000000000000') AS rankings,
  (SELECT COUNT(*) FROM courses
     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000'
       AND cardinality(term_options) = 1) AS single_quarter_courses,
  (SELECT COUNT(*) FROM courses
     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000'
       AND cardinality(term_options) > 1) AS spanning_courses,
  (SELECT COUNT(*) FROM courses
     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000'
       AND prereq_options IS NOT NULL) AS with_prereqs,
  (SELECT COUNT(*) FROM courses
     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000'
       AND coreq_options IS NOT NULL) AS with_coreqs,
  (SELECT COUNT(*) FROM graduation_requirements
     WHERE school_id = 'a2b20000-0000-4000-a000-000000000000') AS grad_reqs;

-- Department size skew check
SELECT d.name, COUNT(c.id) AS course_count
FROM departments d
LEFT JOIN courses c ON c.department_id = d.id
WHERE d.school_id = 'a2b20000-0000-4000-a000-000000000000'
GROUP BY d.name
ORDER BY course_count DESC;

-- Term pattern coverage (each should be >= 2)
SELECT term_options, COUNT(*) AS n
FROM courses
WHERE school_id = 'a2b20000-0000-4000-a000-000000000000'
GROUP BY term_options
ORDER BY n DESC;

COMMIT;
