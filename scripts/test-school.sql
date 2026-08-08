-- Test School — full seed for the custom-term / term_options data model
--
-- Creates a school called "test" with THREE trimester terms and a varied
-- catalog of courses across six departments. Demonstrates every term shape:
--   * single-trimester courses            e.g. term_options = {T2}
--   * two-trimester spanning offerings     e.g. term_options = {T1,T2}
--   * full-year spanning offerings         e.g. term_options = {T1,T2,T3}
--   * independent offerings (multiple rows, same course, different terms)
--     which the app merges into one card with an offering picker.
--
-- Prerequisites/corequisites live on courses.prereq_options / coreq_options as
-- text[][] in disjunctive normal form (outer = OR-groups, inner = AND-groups;
-- each element is a course UUID as text OR free text). Postgres arrays must be
-- rectangular, so mixed-length AND-groups are padded with '' (ignored by the app).
--
-- Fixed UUIDs are used so courses can reference each other directly. Re-running
-- will conflict on primary keys; run once on a clean database (or delete the
-- test school first).
--
-- Prerequisite: run scripts/drop-terms-season-year.sql first.

BEGIN;

----------------------------------------------------------------------
-- 1. School
----------------------------------------------------------------------
INSERT INTO schools (id, name, website, city, state, rankings)
VALUES (
  '7e570000-0000-4000-a000-000000000000',
  'test',
  'https://test.example.edu',
  'Springfield',
  'CA',
  5
);

-- Teacher password lives hashed in school_secrets (scripts/teacher-auth.sql).
SELECT set_school_password('7e570000-0000-4000-a000-000000000000', 'test123');

----------------------------------------------------------------------
-- 2. Terms (three trimesters, ordered by position)
--    Requires scripts/drop-terms-season-year.sql to have been run first.
----------------------------------------------------------------------
INSERT INTO terms (id, school_id, name, position) VALUES
  ('7e571111-0000-4000-a000-000000000001', '7e570000-0000-4000-a000-000000000000', 'Trimester 1', 1),
  ('7e571111-0000-4000-a000-000000000002', '7e570000-0000-4000-a000-000000000000', 'Trimester 2', 2),
  ('7e571111-0000-4000-a000-000000000003', '7e570000-0000-4000-a000-000000000000', 'Trimester 3', 3);

----------------------------------------------------------------------
-- 3. Departments
----------------------------------------------------------------------
INSERT INTO departments (id, school_id, name, code, graduation_requirement, subtitle) VALUES
  ('7e572222-0000-4000-a000-000000000001', '7e570000-0000-4000-a000-000000000000', 'English',              'ENG',  '4 years required',                    'Reading, writing, and communication.'),
  ('7e572222-0000-4000-a000-000000000002', '7e570000-0000-4000-a000-000000000000', 'Mathematics',          'MATH', '3 years required, through Algebra II', 'Quantitative reasoning and problem solving.'),
  ('7e572222-0000-4000-a000-000000000003', '7e570000-0000-4000-a000-000000000000', 'Science',              'SCI',  '3 years required, including Biology', 'Inquiry-based laboratory science.'),
  ('7e572222-0000-4000-a000-000000000004', '7e570000-0000-4000-a000-000000000000', 'History',              'HIST', '3 years required',                    'History and the social sciences.'),
  ('7e572222-0000-4000-a000-000000000005', '7e570000-0000-4000-a000-000000000000', 'Computer Science',     'CS',   'Elective',                            'Computing, software, and data.'),
  ('7e572222-0000-4000-a000-000000000006', '7e570000-0000-4000-a000-000000000000', 'Arts',                 'ARTS', '1 year required',                     'Visual and performing arts.');

----------------------------------------------------------------------
-- 4. Teachers
----------------------------------------------------------------------
INSERT INTO teachers (id, school_id, first_name, last_name, email, department) VALUES
  ('7e573333-0000-4000-a000-000000000001', '7e570000-0000-4000-a000-000000000000', 'Sarah',  'Mitchell', 'sarah.mitchell@test.example.edu', 'English'),
  ('7e573333-0000-4000-a000-000000000002', '7e570000-0000-4000-a000-000000000000', 'David',  'Okafor',   'david.okafor@test.example.edu',  'English'),
  ('7e573333-0000-4000-a000-000000000003', '7e570000-0000-4000-a000-000000000000', 'Priya',  'Nair',     'priya.nair@test.example.edu',    'Mathematics'),
  ('7e573333-0000-4000-a000-000000000004', '7e570000-0000-4000-a000-000000000000', 'James',  'Sullivan', 'james.sullivan@test.example.edu', 'Mathematics'),
  ('7e573333-0000-4000-a000-000000000005', '7e570000-0000-4000-a000-000000000000', 'Elena',  'Vasquez',  'elena.vasquez@test.example.edu', 'Science'),
  ('7e573333-0000-4000-a000-000000000006', '7e570000-0000-4000-a000-000000000000', 'Marcus', 'Lee',      'marcus.lee@test.example.edu',    'Science'),
  ('7e573333-0000-4000-a000-000000000007', '7e570000-0000-4000-a000-000000000000', 'Angela', 'Foster',   'angela.foster@test.example.edu', 'History'),
  ('7e573333-0000-4000-a000-000000000008', '7e570000-0000-4000-a000-000000000000', 'Ryan',   'Chen',     'ryan.chen@test.example.edu',     'Computer Science'),
  ('7e573333-0000-4000-a000-000000000009', '7e570000-0000-4000-a000-000000000000', 'Nina',   'Kowalski', 'nina.kowalski@test.example.edu', 'Arts');

----------------------------------------------------------------------
-- 5. Courses
--    Columns left unset (custom_prereq/custom_coreq/or_prereq/or_coreq) fall
--    back to their schema defaults. `term` is the legacy enum; the app reads
--    only `term_options`, so it is stored as ''.
--
-- Term id shorthands:
--    T1 = 7e571111-0000-4000-a000-000000000001
--    T2 = 7e571111-0000-4000-a000-000000000002
--    T3 = 7e571111-0000-4000-a000-000000000003
----------------------------------------------------------------------
INSERT INTO courses (
  id, title, short_description, long_description, grade, term, subject,
  school_id, teacher_id, department_id, retakeable, prereq_options,
  coreq_options, max_student_count, term_options
) VALUES

  -- ===== English =====
  -- English 9: full-year foundation, no requirements.
  ('7e574444-0000-4000-a000-000000000001', 'English 9', 'Foundations of literature and composition.',
   'A full-year introduction to close reading, analytical writing, and discussion across genres.',
   ARRAY[9], '', 'English', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000001', '7e572222-0000-4000-a000-000000000001', false,
   NULL, NULL, 25,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- English 10: full-year, requires English 9 (single course prereq).
  ('7e574444-0000-4000-a000-000000000002', 'English 10', 'World literature and rhetoric.',
   'A full-year survey of world literature with an emphasis on argument and rhetorical analysis.',
   ARRAY[10], '', 'English', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000001', '7e572222-0000-4000-a000-000000000001', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000001']],
   NULL, 25,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Creative Writing: single trimester (T2); English 10 OR instructor permission.
  ('7e574444-0000-4000-a000-000000000003', 'Creative Writing Workshop', 'Poetry, fiction, and craft.',
   'A workshop-based elective exploring poetry and short fiction through drafting and peer critique.',
   ARRAY[11,12], '', 'English', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000002', '7e572222-0000-4000-a000-000000000001', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000002'], ARRAY['Instructor permission']],
   NULL, 18,
   ARRAY['7e571111-0000-4000-a000-000000000002']::uuid[]),

  -- Journalism: spans T1-T2; corequisite English 10; retakeable.
  ('7e574444-0000-4000-a000-000000000004', 'Journalism', 'Reporting for the student paper.',
   'Students research, write, and edit articles for the school newspaper across two trimesters.',
   ARRAY[10,11,12], '', 'English', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000002', '7e572222-0000-4000-a000-000000000001', true,
   NULL,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000002']], 20,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002']::uuid[]),

  -- ===== Mathematics =====
  -- Algebra I: full-year foundation.
  ('7e574444-0000-4000-a000-000000000011', 'Algebra I', 'Linear and quadratic reasoning.',
   'A full-year course covering expressions, equations, functions, and quadratics.',
   ARRAY[9], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000003', '7e572222-0000-4000-a000-000000000002', false,
   NULL, NULL, 30,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Geometry: full-year, requires Algebra I.
  ('7e574444-0000-4000-a000-000000000012', 'Geometry', 'Proof, shape, and measurement.',
   'A full-year course on Euclidean geometry, proof, transformations, and trigonometry basics.',
   ARRAY[9,10], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000003', '7e572222-0000-4000-a000-000000000002', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000011']],
   NULL, 28,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Algebra II: full-year, requires Geometry AND Algebra I (one AND-group).
  ('7e574444-0000-4000-a000-000000000013', 'Algebra II', 'Advanced functions and modeling.',
   'A full-year course extending to polynomial, exponential, logarithmic, and rational functions.',
   ARRAY[10,11], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000004', '7e572222-0000-4000-a000-000000000002', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000012','7e574444-0000-4000-a000-000000000011']],
   NULL, 26,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Precalculus: full-year, requires Algebra II.
  ('7e574444-0000-4000-a000-000000000014', 'Precalculus', 'Toward the calculus.',
   'A full-year course covering advanced trigonometry, sequences, series, and limits.',
   ARRAY[11,12], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000004', '7e572222-0000-4000-a000-000000000002', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000013']],
   NULL, 24,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- AP Calculus: full-year, requires Precalculus.
  ('7e574444-0000-4000-a000-000000000015', 'AP Calculus', 'Differential and integral calculus.',
   'A rigorous full-year calculus course preparing students for the AP examination.',
   ARRAY[12], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000003', '7e572222-0000-4000-a000-000000000002', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000014']],
   NULL, 20,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Statistics: single trimester (T3), Algebra II OR instructor permission.
  ('7e574444-0000-4000-a000-000000000016', 'Statistics', 'Data, probability, and inference.',
   'A single-trimester introduction to descriptive statistics, probability, and inference.',
   ARRAY[11,12], '', 'Mathematics', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000004', '7e572222-0000-4000-a000-000000000002', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000013'], ARRAY['Instructor permission']],
   NULL, 24,
   ARRAY['7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- ===== Science =====
  -- Biology: full-year foundation, corequisite Algebra I.
  ('7e574444-0000-4000-a000-000000000021', 'Biology', 'Cells, genetics, and ecology.',
   'A full-year laboratory course covering cellular biology, genetics, evolution, and ecology.',
   ARRAY[9,10], '', 'Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000005', '7e572222-0000-4000-a000-000000000003', false,
   NULL,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000011']], 24,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Chemistry: full-year, requires Biology, corequisite Algebra II.
  ('7e574444-0000-4000-a000-000000000022', 'Chemistry', 'Matter, reactions, and bonding.',
   'A full-year laboratory course on atomic structure, bonding, reactions, and stoichiometry.',
   ARRAY[10,11], '', 'Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000005', '7e572222-0000-4000-a000-000000000003', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000021']],
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000013']], 24,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Physics: full-year; (Algebra II AND Geometry) OR Precalculus; coreq Precalculus.
  -- The two OR-groups have different lengths, so the shorter is padded with ''.
  ('7e574444-0000-4000-a000-000000000023', 'Physics', 'Motion, energy, and fields.',
   'A full-year laboratory course spanning mechanics, energy, waves, and electromagnetism.',
   ARRAY[11,12], '', 'Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000006', '7e572222-0000-4000-a000-000000000003', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000013','7e574444-0000-4000-a000-000000000012'], ARRAY['7e574444-0000-4000-a000-000000000014','']],
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000014']], 22,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Environmental Science: single trimester (T1); Biology OR placement test.
  ('7e574444-0000-4000-a000-000000000024', 'Environmental Science', 'Systems, climate, and sustainability.',
   'A single-trimester elective examining ecosystems, climate change, and human impact.',
   ARRAY[10,11,12], '', 'Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000006', '7e572222-0000-4000-a000-000000000003', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000021'], ARRAY['Placement test']],
   NULL, 26,
   ARRAY['7e571111-0000-4000-a000-000000000001']::uuid[]),

  -- ===== History =====
  -- World History: full-year foundation.
  ('7e574444-0000-4000-a000-000000000031', 'World History', 'Civilizations across time.',
   'A full-year survey of world civilizations from antiquity to the modern era.',
   ARRAY[9], '', 'History', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000007', '7e572222-0000-4000-a000-000000000004', false,
   NULL, NULL, 30,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- US History: full-year, requires World History.
  ('7e574444-0000-4000-a000-000000000032', 'US History', 'The American experience.',
   'A full-year study of United States history from the colonial period to the present.',
   ARRAY[10,11], '', 'History', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000007', '7e572222-0000-4000-a000-000000000004', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000031']],
   NULL, 28,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Economics: single trimester (T2); free-text corequisite.
  ('7e574444-0000-4000-a000-000000000033', 'Economics', 'Micro and macro foundations.',
   'A single-trimester elective introducing microeconomics, macroeconomics, and markets.',
   ARRAY[11,12], '', 'History', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000007', '7e572222-0000-4000-a000-000000000004', false,
   NULL,
   ARRAY[ARRAY['Concurrent enrollment in a math course']], 25,
   ARRAY['7e571111-0000-4000-a000-000000000002']::uuid[]),

  -- Psychology: single trimester (T3), no requirements.
  ('7e574444-0000-4000-a000-000000000034', 'Psychology', 'Mind and behavior.',
   'A single-trimester elective surveying cognition, development, and social psychology.',
   ARRAY[11,12], '', 'History', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000007', '7e572222-0000-4000-a000-000000000004', false,
   NULL, NULL, 25,
   ARRAY['7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- ===== Computer Science =====
  -- Intro to CS: single trimester (T1), no requirements.
  ('7e574444-0000-4000-a000-000000000041', 'Intro to Computer Science', 'Programming fundamentals.',
   'A single-trimester introduction to programming, control flow, and problem decomposition.',
   ARRAY[9,10,11,12], '', 'Computer Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000008', '7e572222-0000-4000-a000-000000000005', false,
   NULL, NULL, 30,
   ARRAY['7e571111-0000-4000-a000-000000000001']::uuid[]),

  -- Data Structures: spans T1-T2, requires Intro to CS.
  ('7e574444-0000-4000-a000-000000000042', 'Data Structures', 'Organizing and processing data.',
   'A two-trimester course on lists, trees, graphs, and algorithmic complexity.',
   ARRAY[10,11,12], '', 'Computer Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000008', '7e572222-0000-4000-a000-000000000005', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000041']],
   NULL, 24,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002']::uuid[]),

  -- Web Development: offered independently in T2 AND in T3 (two rows, identical
  -- except term_options) so the app merges them into one card with an offering
  -- picker. Intro to CS OR approval of instructor.
  ('7e574444-0000-4000-a000-000000000043', 'Web Development', 'Building for the browser.',
   'A single-trimester elective on HTML, CSS, and JavaScript, culminating in a small web app.',
   ARRAY[10,11,12], '', 'Computer Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000008', '7e572222-0000-4000-a000-000000000005', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000041'], ARRAY['Approval of instructor']],
   NULL, 20,
   ARRAY['7e571111-0000-4000-a000-000000000002']::uuid[]),
  ('7e574444-0000-4000-a000-000000000044', 'Web Development', 'Building for the browser.',
   'A single-trimester elective on HTML, CSS, and JavaScript, culminating in a small web app.',
   ARRAY[10,11,12], '', 'Computer Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000008', '7e572222-0000-4000-a000-000000000005', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000041'], ARRAY['Approval of instructor']],
   NULL, 20,
   ARRAY['7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Machine Learning: spans T2-T3; Data Structures AND Statistics; coreq AP Calculus.
  ('7e574444-0000-4000-a000-000000000045', 'Machine Learning', 'Models that learn from data.',
   'A two-trimester capstone elective covering regression, classification, and neural networks.',
   ARRAY[11,12], '', 'Computer Science', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000008', '7e572222-0000-4000-a000-000000000005', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000042','7e574444-0000-4000-a000-000000000016']],
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000015']], 16,
   ARRAY['7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- ===== Arts =====
  -- Studio Art I: offered independently in EACH trimester (three rows, identical
  -- except term_options); retakeable. No requirements.
  ('7e574444-0000-4000-a000-000000000051', 'Studio Art I', 'Foundations of visual art.',
   'A single-trimester studio introducing drawing, color, and composition. Offered each trimester.',
   ARRAY[9,10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', true,
   NULL, NULL, 18,
   ARRAY['7e571111-0000-4000-a000-000000000001']::uuid[]),
  ('7e574444-0000-4000-a000-000000000052', 'Studio Art I', 'Foundations of visual art.',
   'A single-trimester studio introducing drawing, color, and composition. Offered each trimester.',
   ARRAY[9,10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', true,
   NULL, NULL, 18,
   ARRAY['7e571111-0000-4000-a000-000000000002']::uuid[]),
  ('7e574444-0000-4000-a000-000000000053', 'Studio Art I', 'Foundations of visual art.',
   'A single-trimester studio introducing drawing, color, and composition. Offered each trimester.',
   ARRAY[9,10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', true,
   NULL, NULL, 18,
   ARRAY['7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Studio Art II: spans T1-T2, requires Studio Art I (references the T1 row).
  ('7e574444-0000-4000-a000-000000000054', 'Studio Art II', 'Advanced studio practice.',
   'A two-trimester studio building on Studio Art I with a portfolio of independent work.',
   ARRAY[10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', false,
   ARRAY[ARRAY['7e574444-0000-4000-a000-000000000051']],
   NULL, 16,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002']::uuid[]),

  -- Music Ensemble: full-year, retakeable; free-text corequisite.
  ('7e574444-0000-4000-a000-000000000055', 'Music Ensemble', 'Perform as an ensemble.',
   'A full-year performance ensemble rehearsing and presenting concerts each trimester.',
   ARRAY[9,10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', true,
   NULL,
   ARRAY[ARRAY['Ability to read music or instructor approval']], 40,
   ARRAY['7e571111-0000-4000-a000-000000000001','7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]),

  -- Theater Production: spans T2-T3, retakeable, no requirements.
  ('7e574444-0000-4000-a000-000000000056', 'Theater Production', 'Stage a full production.',
   'A two-trimester course producing a full theatrical performance, from auditions to opening night.',
   ARRAY[10,11,12], '', 'Arts', '7e570000-0000-4000-a000-000000000000',
   '7e573333-0000-4000-a000-000000000009', '7e572222-0000-4000-a000-000000000006', true,
   NULL, NULL, 24,
   ARRAY['7e571111-0000-4000-a000-000000000002','7e571111-0000-4000-a000-000000000003']::uuid[]);

----------------------------------------------------------------------
-- 6. Graduation requirements (foundational courses)
----------------------------------------------------------------------
INSERT INTO graduation_requirements (
  school_id, course_id, must_complete_by_grade, must_complete_before_graduation, recommended_grade
) VALUES
  ('7e570000-0000-4000-a000-000000000000', '7e574444-0000-4000-a000-000000000001',  9, true,  9),  -- English 9
  ('7e570000-0000-4000-a000-000000000000', '7e574444-0000-4000-a000-000000000011', 10, true,  9),  -- Algebra I
  ('7e570000-0000-4000-a000-000000000000', '7e574444-0000-4000-a000-000000000021', 10, true,  9),  -- Biology
  ('7e570000-0000-4000-a000-000000000000', '7e574444-0000-4000-a000-000000000031', 10, true,  9);  -- World History

----------------------------------------------------------------------
-- 7. Sample students (exercise the student-scoped tables)
----------------------------------------------------------------------
INSERT INTO students (id, school_id, name, email, grade, graduation_year) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e570000-0000-4000-a000-000000000000', 'Alex Rivera',  'alex.rivera@test.example.edu', 11, 2028),
  ('7e575555-0000-4000-a000-000000000002', '7e570000-0000-4000-a000-000000000000', 'Jordan Kim',   'jordan.kim@test.example.edu',  10, 2029);

-- Completed courses
INSERT INTO completed_courses (student_id, course_id) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000001'), -- Alex: English 9
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000002'), -- Alex: English 10
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000011'), -- Alex: Algebra I
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000012'), -- Alex: Geometry
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000021'), -- Alex: Biology
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000031'), -- Alex: World History
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000041'), -- Alex: Intro to CS
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000001'), -- Jordan: English 9
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000011'), -- Jordan: Algebra I
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000031'); -- Jordan: World History

-- Enrolled (in-progress) courses
INSERT INTO enrolled_courses (student_id, course_id) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000013'), -- Alex: Algebra II
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000032'), -- Alex: US History
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000012'); -- Jordan: Geometry

-- Bookmarked courses (candidates for ranking)
INSERT INTO bookmarked_courses (student_id, course_id) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000042'), -- Alex: Data Structures
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000043'), -- Alex: Web Development (T2)
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000045'), -- Alex: Machine Learning
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000014'), -- Alex: Precalculus
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000051'), -- Jordan: Studio Art I (T1)
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000055'); -- Jordan: Music Ensemble

-- Course notes
INSERT INTO course_notes (student_id, course_id, note) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000045', 'Want this for my senior year capstone.'),
  ('7e575555-0000-4000-a000-000000000002', '7e574444-0000-4000-a000-000000000055', 'I play the cello.');

-- Submitted rankings (Alex has submitted; preference is per-term rank)
INSERT INTO submitted_courses (student_id, course_id, preference, submitted) VALUES
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000042', 1, true), -- Data Structures
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000045', 2, true), -- Machine Learning
  ('7e575555-0000-4000-a000-000000000001', '7e574444-0000-4000-a000-000000000014', 3, true); -- Precalculus

-- Submitted appeal note
INSERT INTO submitted_notes (student_id, note) VALUES
  ('7e575555-0000-4000-a000-000000000001', 'Please prioritize Machine Learning if there is space.');

----------------------------------------------------------------------
-- 8. Verification output
----------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM terms       WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS terms,
  (SELECT COUNT(*) FROM departments WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS departments,
  (SELECT COUNT(*) FROM teachers    WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS teachers,
  (SELECT COUNT(*) FROM courses     WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS courses,
  (SELECT COUNT(*) FROM courses     WHERE school_id = '7e570000-0000-4000-a000-000000000000' AND cardinality(term_options) > 1) AS spanning_courses,
  (SELECT COUNT(*) FROM graduation_requirements WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS grad_reqs,
  (SELECT COUNT(*) FROM students    WHERE school_id = '7e570000-0000-4000-a000-000000000000') AS students;

COMMIT;
