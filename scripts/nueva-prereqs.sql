-- The Nueva School — 2026–2027 prerequisite / corequisite rebuild
--
-- Single, comprehensive source of truth for every Nueva course's structured
-- prerequisite/corequisite links plus free-text requirement wording. It clears
-- and rebuilds everything, so it SUPERSEDES:
--   * scripts/nueva-school.sql §5 (prerequisites) and §6 (corequisites)
--   * scripts/nueva-arts.sql §4 (arts prerequisites)
--   * scripts/nueva-custom-prereqs.sql (custom_prereq / custom_coreq text)
-- Run it LAST (after nueva-school.sql and nueva-arts.sql). Safe to re-run.
--
-- Classification rules (per catalog requirement string):
--   * Single real course ("Physics") -> one link row; or_* = false.
--   * "A and B" (all real courses) -> multiple link rows; or_* = false.
--   * "A or B" / "A, B, or C" (all real courses) -> all link rows AND or_* = true.
--   * Hard free text naming no specific course ("Student must play an instrument",
--     "Any economics class", "Consent of Instructor", "Math Department Approval",
--     "Completed Course Application", "At least one non-intro CS elective", the
--     Teaching Fellowship steps) -> custom_prereq / custom_coreq. Because it cannot
--     be verified from completed courses, the front end never auto-marks the course
--     as "prerequisite met" (course prereq AND free text).
--   * Escape-hatch alternatives appended with "or" ("or equivalent",
--     ", or approval of instructor", ", or grade 12 students with permission...")
--     and non-binding notes ("(or Higher)", "(Fall Semester)", "ideally one more
--     elective...") -> DROPPED. Only the real course(s) are kept, so the course
--     stays satisfiable by completing the real prerequisite(s).
--
-- Matches rows by school + course title.

BEGIN;

----------------------------------------------------------------------
-- 0. Ensure the OR-flag columns exist (defensive; already present in prod)
----------------------------------------------------------------------
ALTER TABLE courses ADD COLUMN IF NOT EXISTS or_prereq boolean NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS or_coreq  boolean NOT NULL DEFAULT false;

----------------------------------------------------------------------
-- 1. Reset all Nueva prereq/coreq state so this file fully owns it
----------------------------------------------------------------------
-- Prerequisite links (both directions: as the course and as a prerequisite).
DELETE FROM course_prerequisites cp
USING courses c
JOIN schools s ON s.id = c.school_id
WHERE cp.course_id = c.id
  AND s.name = $c$The Nueva School$c$;

DELETE FROM course_prerequisites cp
USING courses p
JOIN schools s ON s.id = p.school_id
WHERE cp.prerequisite_course_id = p.id
  AND s.name = $c$The Nueva School$c$;

-- Corequisite links (both directions).
DELETE FROM course_corequisites cc
USING courses c
JOIN schools s ON s.id = c.school_id
WHERE cc.course_id = c.id
  AND s.name = $c$The Nueva School$c$;

DELETE FROM course_corequisites cc
USING courses co
JOIN schools s ON s.id = co.school_id
WHERE cc.corequisite_course_id = co.id
  AND s.name = $c$The Nueva School$c$;

-- Custom text and OR flags.
UPDATE courses c
SET custom_prereq = $c$$c$,
    custom_coreq  = $c$$c$,
    or_prereq     = false,
    or_coreq      = false
FROM schools s
WHERE c.school_id = s.id
  AND s.name = $c$The Nueva School$c$;

----------------------------------------------------------------------
-- 2. Prerequisites (single + "and" lists + every option of an "or" choice)
----------------------------------------------------------------------
INSERT INTO course_prerequisites (course_id, prerequisite_course_id)
SELECT c.id, p.id
FROM (
  VALUES
    -- Visual Arts (each Advanced medium requires its Intro)
    ($c$Adv. Art & Fabrication$c$, $c$Intro to Art & Fabrication$c$),
    ($c$Adv. Clay Sculpture$c$, $c$Intro to Clay Sculpture$c$),
    ($c$Adv. Drawing$c$, $c$Intro to Drawing$c$),
    ($c$Adv. Film & Video$c$, $c$Intro to Film & Video$c$),
    ($c$Adv. Painting$c$, $c$Intro to Painting$c$),
    ($c$Adv. Photography$c$, $c$Intro to Photography$c$),
    -- Computer Science ("Intro to Computer Programming OR Intro to Data Analysis"; OR)
    ($c$Algorithms$c$, $c$Intro to Computer Programming$c$),
    ($c$Algorithms$c$, $c$Intro to Data Analysis$c$),
    ($c$Computer Security$c$, $c$Intro to Computer Programming$c$),
    ($c$Computer Security$c$, $c$Intro to Data Analysis$c$),
    ($c$Computer Vision$c$, $c$Intro to Computer Programming$c$),
    ($c$Computer Vision$c$, $c$Intro to Data Analysis$c$),
    ($c$Data Science$c$, $c$Intro to Computer Programming$c$),
    ($c$Data Science$c$, $c$Intro to Data Analysis$c$),
    ($c$Mobile App Development$c$, $c$Intro to Computer Programming$c$),
    ($c$Mobile App Development$c$, $c$Intro to Data Analysis$c$),
    ($c$Programming with OOP$c$, $c$Intro to Computer Programming$c$),
    ($c$Programming with OOP$c$, $c$Intro to Data Analysis$c$),
    ($c$Video Game Programming$c$, $c$Intro to Computer Programming$c$),
    ($c$Video Game Programming$c$, $c$Intro to Data Analysis$c$),
    -- Economics ("Any economics class AND History 10"; the course part only)
    ($c$Economic Thesis Seminar$c$, $c$History 10 - Modern World$c$),
    -- Economics ("Intro to Microeconomics AND Math 2"; AND)
    ($c$Models of Group Decisions$c$, $c$Intro to Microeconomics$c$),
    ($c$Models of Group Decisions$c$, $c$Math 2$c$),
    -- Engineering, Fabrication & Design
    ($c$Applied Engineering: Biomedical$c$, $c$Physics$c$),
    ($c$Materials Engineering$c$, $c$Physics$c$),
    ($c$Mechanical Engineering$c$, $c$Physics$c$),
    -- English
    ($c$English 10$c$, $c$English 9$c$),
    ($c$English 11$c$, $c$English 10$c$),
    ($c$War and Conflict in Literature$c$, $c$English 9$c$),
    ($c$Monstrosity$c$, $c$English 9$c$),
    ($c$Memoir and Adaptation$c$, $c$English 9$c$),
    ($c$19th-Century Adaptations$c$, $c$English 9$c$),
    ($c$Shakespeare Ever After$c$, $c$English 9$c$),
    ($c$The Tie that Binds: Family Dynamics in Shakespeare$c$, $c$English 9$c$),
    ($c$Women in Literature$c$, $c$English 9$c$),
    -- History
    ($c$Capitalism & Apocalypse$c$, $c$History 10 - Modern World$c$),
    ($c$History 10 - Modern World$c$, $c$History 9 - World to 1500$c$),
    ($c$History 11 - US History$c$, $c$History 10 - Modern World$c$),
    ($c$International Relations$c$, $c$History 10 - Modern World$c$),
    ($c$Religion and Modernity$c$, $c$History 9 - World to 1500$c$),
    ($c$Sociocultural Anthropology: Culture, Exchange, Technology Studies$c$, $c$History 9 - World to 1500$c$),
    -- Interdisciplinary (Psychology 101 = Intro to Psychology; escape hatches dropped)
    ($c$Psychological Disorders: Body, Mind, and Culture$c$, $c$Intro to Psychology$c$),
    ($c$Psychology and Memory$c$, $c$Intro to Psychology$c$),
    ($c$Research in Psychology$c$, $c$Intro to Psychology$c$),
    -- Interdisciplinary ("Chinese 2, Japanese 2, Spanish 2, or the equivalent"; OR)
    ($c$Translation Studies$c$, $c$Chinese 2$c$),
    ($c$Translation Studies$c$, $c$Japanese 2$c$),
    ($c$Translation Studies$c$, $c$Spanish 2$c$),
    -- Languages ("X or equivalent" -> single course X)
    ($c$Chinese 2$c$, $c$Chinese 1$c$),
    ($c$Chinese 3$c$, $c$Chinese 2$c$),
    ($c$Chinese 4$c$, $c$Chinese 3$c$),
    ($c$Chinese 5: Current Events & Film$c$, $c$Chinese 4$c$),
    ($c$Chinese Literature & Advanced Research$c$, $c$Chinese 4$c$),
    ($c$Japanese 2$c$, $c$Japanese 1$c$),
    ($c$Japanese 3$c$, $c$Japanese 2$c$),
    ($c$Japanese 4$c$, $c$Japanese 3$c$),
    ($c$Adv. Topics in Japanese$c$, $c$Japanese 4$c$),
    ($c$Spanish 2$c$, $c$Spanish 1$c$),
    ($c$Spanish 3$c$, $c$Spanish 2$c$),
    ($c$Spanish 4$c$, $c$Spanish 3$c$),
    ($c$Spanish Communication$c$, $c$Spanish 4$c$),
    ($c$Advanced Topics in Spanish: Cultural Analysis and Lifestyles$c$, $c$Spanish 4$c$),
    -- Math (non-binding "ideally..."/"(Fall Semester)" notes dropped)
    ($c$Advanced Probability$c$, $c$Calculus$c$),
    ($c$Calculus$c$, $c$Math 3$c$),
    ($c$Complex Analysis$c$, $c$Calculus$c$),
    ($c$Computational Biology$c$, $c$Math 3$c$),
    ($c$Core Mathematics Intensive X$c$, $c$Math 1$c$),
    ($c$Core Mathematics Intensive Y$c$, $c$Math 1$c$),
    ($c$Differential Equations$c$, $c$Calculus$c$),
    ($c$Geometries Beyond Euclid$c$, $c$Math 3$c$),
    ($c$Linear Algebra$c$, $c$Math 3$c$),
    ($c$Math 2$c$, $c$Math 1$c$),
    ($c$Math 3$c$, $c$Math 2$c$),
    ($c$Math and Philosophy for Human Flourishing$c$, $c$Math 1$c$),
    ($c$Mathematical Modeling$c$, $c$Calculus$c$),
    ($c$Multivariable Calculus$c$, $c$Calculus$c$),
    ($c$Statistics$c$, $c$Math 2$c$),
    -- Science ("Physics & Calculus"; AND)
    ($c$Advanced Mechanics$c$, $c$Physics$c$),
    ($c$Advanced Mechanics$c$, $c$Calculus$c$),
    ($c$Anatomy and Physiology$c$, $c$Biology$c$),
    ($c$Biology$c$, $c$Chemistry$c$),
    ($c$Biology Research Teams 1$c$, $c$Chemistry$c$),
    ($c$Biology Research Teams 2$c$, $c$Biology Research Teams 1$c$),
    ($c$Bioorganic Chemistry$c$, $c$Chemistry$c$),
    ($c$Chemical Engineering$c$, $c$Chemistry$c$),
    ($c$Chemistry Consulting$c$, $c$Chemistry$c$),
    ($c$Chemistry Consulting$c$, $c$Math 2$c$),
    -- Science ("Chemical Engineering OR Bioorganic Chemistry"; OR)
    ($c$Drug Design$c$, $c$Chemical Engineering$c$),
    ($c$Drug Design$c$, $c$Bioorganic Chemistry$c$),
    ($c$Immunology$c$, $c$Biology$c$),
    ($c$Mechanisms of Cancer$c$, $c$Biology$c$),
    ($c$Modern Physics$c$, $c$Physics$c$),
    ($c$Optics & Astrophysics$c$, $c$Physics$c$),
    ($c$Physics Research$c$, $c$Physics$c$),
    ($c$Semiconductor Processes$c$, $c$Modern Physics$c$),
    ($c$Sensory Neuroscience$c$, $c$Biology$c$),
    -- SEL
    ($c$Social Emotional Learning 10$c$, $c$Social Emotional Learning 9$c$),
    ($c$Social Emotional Learning 11$c$, $c$Social Emotional Learning 10$c$),
    ($c$Social Emotional Learning 12: The Good Life$c$, $c$Social Emotional Learning 11$c$)
) AS pre(course_title, prereq_title)
CROSS JOIN schools s
JOIN courses c ON c.school_id = s.id AND c.title = pre.course_title
JOIN courses p ON p.school_id = s.id AND p.title = pre.prereq_title
WHERE s.name = $c$The Nueva School$c$;

----------------------------------------------------------------------
-- 3. Corequisites (single + "and" lists + every option of an "or" choice)
----------------------------------------------------------------------
INSERT INTO course_corequisites (course_id, corequisite_course_id)
SELECT c.id, co.id
FROM (
  VALUES
    ($c$Algebra Techniques$c$, $c$Math 1$c$),
    ($c$Core Mathematics Intensive X$c$, $c$Core Mathematics Intensive Y$c$),
    ($c$Core Mathematics Intensive Y$c$, $c$Core Mathematics Intensive X$c$),
    ($c$Bioorganic Chemistry$c$, $c$Math 3$c$),
    ($c$Chemical Engineering$c$, $c$Math 3$c$),
    -- Physics: "Math 2 (or Higher)" -> Math 2 (escape hatch dropped)
    ($c$Physics$c$, $c$Math 2$c$)
) AS coreq(course_title, coreq_title)
CROSS JOIN schools s
JOIN courses c ON c.school_id = s.id AND c.title = coreq.course_title
JOIN courses co ON co.school_id = s.id AND co.title = coreq.coreq_title
WHERE s.name = $c$The Nueva School$c$;

----------------------------------------------------------------------
-- 4. OR flags (a single completed option satisfies the requirement)
----------------------------------------------------------------------
UPDATE courses c
SET or_prereq = true
FROM schools s
WHERE c.school_id = s.id
  AND s.name = $c$The Nueva School$c$
  AND c.title IN (
    $c$Algorithms$c$,
    $c$Computer Security$c$,
    $c$Computer Vision$c$,
    $c$Data Science$c$,
    $c$Mobile App Development$c$,
    $c$Programming with OOP$c$,
    $c$Video Game Programming$c$,
    $c$Translation Studies$c$,
    $c$Drug Design$c$
  );

-- No OR-choice corequisites exist in the 2026–27 catalog, so or_coreq stays false.

----------------------------------------------------------------------
-- 5. Custom (free-text-only) requirements — these block auto "met"
----------------------------------------------------------------------
UPDATE courses AS c
SET custom_prereq = v.custom_prereq,
    custom_coreq  = v.custom_coreq
FROM (
  VALUES
    -- Performing Arts
    ($c$Jazz Ensemble$c$, $c$Student must play an instrument.$c$, $c$$c$),
    -- Visual Arts
    ($c$Adv. Studio Art$c$, $c$Any 2 full visual art courses (Intro & Advanced).$c$, $c$$c$),
    ($c$Fine Arts Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Computer Science
    ($c$Advanced Machine Learning$c$, $c$At least one non-intro computer science elective at Nueva Upper School.$c$, $c$$c$),
    ($c$Intro to Machine Learning$c$, $c$At least one non-intro computer science elective at Nueva Upper School.$c$, $c$$c$),
    ($c$Software Engineering$c$, $c$At least one non-intro computer science elective at Nueva Upper School and comfort reading and writing code in at least one programming language.$c$, $c$$c$),
    ($c$Computer Science Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Economics (course part "History 10" is a structured link above)
    ($c$Economic Thesis Seminar$c$, $c$Any economics class.$c$, $c$$c$),
    ($c$Economics Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Engineering, Fabrication & Design
    ($c$Engineering, Fabrication & Design Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- English
    ($c$English Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- History
    ($c$History Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Interdisciplinary
    ($c$Interdisciplinary Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Languages
    ($c$Languages Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Math (course part "Math 1" is a structured link above)
    ($c$Core Mathematics Intensive X$c$, $c$Math Department Approval.$c$, $c$$c$),
    ($c$Core Mathematics Intensive Y$c$, $c$Math Department Approval.$c$, $c$$c$),
    ($c$Math Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- Science (course parts "Chemistry" / "Physics" are structured links above)
    ($c$Biology Research Teams 1$c$, $c$Completed Course Application.$c$, $c$$c$),
    ($c$Physics Research$c$, $c$Consent of Instructor.$c$, $c$$c$),
    ($c$Science Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$),
    -- SEL
    ($c$SEL Teaching Fellowship$c$, $c$1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$c$, $c$$c$)
) AS v(title, custom_prereq, custom_coreq)
WHERE c.title = v.title
  AND c.school_id = (SELECT id FROM schools WHERE name = $c$The Nueva School$c$);

COMMIT;
