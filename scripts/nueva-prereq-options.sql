-- The Nueva School — 2026–2027 prerequisite / corequisite rebuild (options arrays)
--
-- Single source of truth for every Nueva course's prerequisites and
-- corequisites, stored on courses.prereq_options / courses.coreq_options as a
-- 2-D text array (text[][]) in disjunctive normal form:
--
--   * The OUTER array is a list of OR-groups (any one satisfies the requirement).
--   * Each INNER array is an AND-group (every element must be satisfied).
--   * Each element is EITHER a course UUID (as text) OR free text.
--
-- Example: ARRAY[ ARRAY[<cpId>], ARRAY[<daId>], ARRAY['approval of instructor'] ]
--   means "Intro to CP  OR  Intro to DA  OR  approval of instructor".
-- Example: ARRAY[ ARRAY[<physId>, <calcId>] ]  means "Physics AND Calculus".
--
-- Fulfillment (frontend): a requirement is MET when at least one OR-group is
-- fully satisfied; a group is satisfied when the student has completed every
-- COURSE element in it. Free-text elements are never auto-satisfied, so a group
-- containing free text cannot auto-pass, but a sibling course-only group still can.
--
-- This file SUPERSEDES, for prereq/coreq purposes:
--   * scripts/nueva-school.sql §5/§6, scripts/nueva-arts.sql §4
--   * scripts/nueva-prereqs.sql, scripts/nueva-custom-prereqs.sql
-- The old course_prerequisites / course_corequisites join tables and the
-- or_/custom_ columns are left intact but are no longer read by the app.
--
-- Course UUIDs are resolved from titles at run time (no hardcoded UUIDs), so the
-- file is portable and re-runnable. Rows are matched by school + title. All
-- Nueva requirements are naturally rectangular; where a course ever mixes
-- AND-group lengths, pad the shorter groups with '' (empty string is ignored by
-- the frontend) to satisfy Postgres's rectangular-array requirement.

BEGIN;

----------------------------------------------------------------------
-- 0. Helpers (auto-dropped at session end; pg_temp is searched first)
----------------------------------------------------------------------

-- Resolve a Nueva course title to its UUID text. Returns NULL if not found,
-- which the verification query at the bottom will flag.
CREATE FUNCTION pg_temp.nid(t text) RETURNS text AS $fn$
  SELECT c.id::text
  FROM courses c
  JOIN schools s ON s.id = c.school_id
  WHERE s.name = $c$The Nueva School$c$
    AND c.title = t
  LIMIT 1;
$fn$ LANGUAGE sql STABLE;

-- The identical two-part Teaching Fellowship requirement, as one AND-group.
CREATE FUNCTION pg_temp.tf() RETURNS text[] AS $fn$
  SELECT ARRAY[
    $c$Successful completion of the desired course$c$,
    $c$Read the Teaching Fellow Program Overview for program details, expectations, and timeline$c$
  ];
$fn$ LANGUAGE sql IMMUTABLE;

----------------------------------------------------------------------
-- 1. Reset so this file fully owns Nueva prereq/coreq option state
----------------------------------------------------------------------
UPDATE courses AS c
SET prereq_options = NULL,
    coreq_options  = NULL
FROM schools s
WHERE c.school_id = s.id
  AND s.name = $c$The Nueva School$c$;

----------------------------------------------------------------------
-- 2. Prerequisites
----------------------------------------------------------------------
UPDATE courses AS c
SET prereq_options = v.opts
FROM (
  VALUES
    -- Visual Arts (each Advanced medium requires its Intro)
    ($c$Adv. Art & Fabrication$c$, ARRAY[ARRAY[pg_temp.nid($c$Intro to Art & Fabrication$c$)]]),
    ($c$Adv. Clay Sculpture$c$,    ARRAY[ARRAY[pg_temp.nid($c$Intro to Clay Sculpture$c$)]]),
    ($c$Adv. Drawing$c$,           ARRAY[ARRAY[pg_temp.nid($c$Intro to Drawing$c$)]]),
    ($c$Adv. Film & Video$c$,      ARRAY[ARRAY[pg_temp.nid($c$Intro to Film & Video$c$)]]),
    ($c$Adv. Painting$c$,          ARRAY[ARRAY[pg_temp.nid($c$Intro to Painting$c$)]]),
    ($c$Adv. Photography$c$,       ARRAY[ARRAY[pg_temp.nid($c$Intro to Photography$c$)]]),
    ($c$Adv. Studio Art$c$,        ARRAY[ARRAY[$c$Any 2 full visual art courses (Intro & Advanced)$c$]]),
    ($c$Fine Arts Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Performing Arts
    ($c$Jazz Ensemble$c$, ARRAY[ARRAY[$c$Student must play an instrument$c$]]),

    -- Computer Science ("Intro to CP OR Intro to DA, OR approval of instructor")
    ($c$Algorithms$c$,              ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Computer Security$c$,       ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Computer Vision$c$,         ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Data Science$c$,            ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Mobile App Development$c$,  ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Programming with OOP$c$,    ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Video Game Programming$c$,  ARRAY[ARRAY[pg_temp.nid($c$Intro to Computer Programming$c$)], ARRAY[pg_temp.nid($c$Intro to Data Analysis$c$)], ARRAY[$c$approval of instructor$c$]]),
    ($c$Advanced Machine Learning$c$, ARRAY[ARRAY[$c$At least one non-intro computer science elective at Nueva Upper School$c$]]),
    ($c$Intro to Machine Learning$c$, ARRAY[ARRAY[$c$At least one non-intro computer science elective at Nueva Upper School$c$]]),
    ($c$Software Engineering$c$,      ARRAY[ARRAY[$c$At least one non-intro computer science elective at Nueva Upper School$c$, $c$Comfortable reading and writing code in at least one programming language$c$]]),
    ($c$Computer Science Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Economics
    ($c$Economic Thesis Seminar$c$, ARRAY[ARRAY[$c$Any economics class$c$, pg_temp.nid($c$History 10 - Modern World$c$)]]),
    ($c$Models of Group Decisions$c$, ARRAY[ARRAY[pg_temp.nid($c$Intro to Microeconomics$c$), pg_temp.nid($c$Math 2$c$)]]),
    ($c$Economics Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Engineering, Fabrication & Design
    ($c$Applied Engineering: Biomedical$c$, ARRAY[ARRAY[pg_temp.nid($c$Physics$c$)]]),
    ($c$Materials Engineering$c$,           ARRAY[ARRAY[pg_temp.nid($c$Physics$c$)]]),
    ($c$Mechanical Engineering$c$,          ARRAY[ARRAY[pg_temp.nid($c$Physics$c$)]]),
    ($c$Engineering, Fabrication & Design Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- English
    ($c$English 10$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$English 11$c$, ARRAY[ARRAY[pg_temp.nid($c$English 10$c$)]]),
    ($c$War and Conflict in Literature$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$Monstrosity$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$Memoir and Adaptation$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$19th-Century Adaptations$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$Shakespeare Ever After$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$The Tie that Binds: Family Dynamics in Shakespeare$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$Women in Literature$c$, ARRAY[ARRAY[pg_temp.nid($c$English 9$c$)]]),
    ($c$English Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- History
    ($c$Capitalism & Apocalypse$c$, ARRAY[ARRAY[pg_temp.nid($c$History 10 - Modern World$c$)]]),
    ($c$History 10 - Modern World$c$, ARRAY[ARRAY[pg_temp.nid($c$History 9 - World to 1500$c$)]]),
    ($c$History 11 - US History$c$, ARRAY[ARRAY[pg_temp.nid($c$History 10 - Modern World$c$)]]),
    ($c$International Relations$c$, ARRAY[ARRAY[pg_temp.nid($c$History 10 - Modern World$c$)]]),
    ($c$Religion and Modernity$c$, ARRAY[ARRAY[pg_temp.nid($c$History 9 - World to 1500$c$)]]),
    ($c$Sociocultural Anthropology: Culture, Exchange, Technology Studies$c$, ARRAY[ARRAY[pg_temp.nid($c$History 9 - World to 1500$c$)]]),
    ($c$History Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Interdisciplinary (Psychology 101 = Intro to Psychology)
    ($c$Psychological Disorders: Body, Mind, and Culture$c$, ARRAY[ARRAY[pg_temp.nid($c$Intro to Psychology$c$)], ARRAY[$c$Seniors who have taken advanced biology classes, anthropology, or online/summer psychology classes may also enroll$c$]]),
    ($c$Psychology and Memory$c$, ARRAY[ARRAY[pg_temp.nid($c$Intro to Psychology$c$)], ARRAY[$c$Grade 12 students with permission of instructor$c$]]),
    ($c$Research in Psychology$c$, ARRAY[ARRAY[pg_temp.nid($c$Intro to Psychology$c$)]]),
    ($c$Translation Studies$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 2$c$)], ARRAY[pg_temp.nid($c$Japanese 2$c$)], ARRAY[pg_temp.nid($c$Spanish 2$c$)], ARRAY[$c$the equivalent$c$]]),
    ($c$Interdisciplinary Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Languages ("X or equivalent")
    ($c$Chinese 2$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 1$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Chinese 3$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 2$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Chinese 4$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 3$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Chinese 5: Current Events & Film$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 4$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Chinese Literature & Advanced Research$c$, ARRAY[ARRAY[pg_temp.nid($c$Chinese 4$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Japanese 2$c$, ARRAY[ARRAY[pg_temp.nid($c$Japanese 1$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Japanese 3$c$, ARRAY[ARRAY[pg_temp.nid($c$Japanese 2$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Japanese 4$c$, ARRAY[ARRAY[pg_temp.nid($c$Japanese 3$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Adv. Topics in Japanese$c$, ARRAY[ARRAY[pg_temp.nid($c$Japanese 4$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Spanish 2$c$, ARRAY[ARRAY[pg_temp.nid($c$Spanish 1$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Spanish 3$c$, ARRAY[ARRAY[pg_temp.nid($c$Spanish 2$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Spanish 4$c$, ARRAY[ARRAY[pg_temp.nid($c$Spanish 3$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Spanish Communication$c$, ARRAY[ARRAY[pg_temp.nid($c$Spanish 4$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Advanced Topics in Spanish: Cultural Analysis and Lifestyles$c$, ARRAY[ARRAY[pg_temp.nid($c$Spanish 4$c$)], ARRAY[$c$equivalent$c$]]),
    ($c$Languages Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Math (non-binding "ideally..."/"(Fall Semester)" notes dropped)
    ($c$Advanced Probability$c$, ARRAY[ARRAY[pg_temp.nid($c$Calculus$c$)]]),
    ($c$Calculus$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    ($c$Complex Analysis$c$, ARRAY[ARRAY[pg_temp.nid($c$Calculus$c$)]]),
    ($c$Computational Biology$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    ($c$Core Mathematics Intensive X$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 1$c$), $c$Math Department Approval$c$]]),
    ($c$Core Mathematics Intensive Y$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 1$c$), $c$Math Department Approval$c$]]),
    ($c$Differential Equations$c$, ARRAY[ARRAY[pg_temp.nid($c$Calculus$c$)]]),
    ($c$Geometries Beyond Euclid$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    ($c$Linear Algebra$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    ($c$Math 2$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 1$c$)]]),
    ($c$Math 3$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 2$c$)]]),
    ($c$Math and Philosophy for Human Flourishing$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 1$c$)]]),
    ($c$Mathematical Modeling$c$, ARRAY[ARRAY[pg_temp.nid($c$Calculus$c$)]]),
    ($c$Multivariable Calculus$c$, ARRAY[ARRAY[pg_temp.nid($c$Calculus$c$)]]),
    ($c$Statistics$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 2$c$)]]),
    ($c$Math Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- Science
    ($c$Advanced Mechanics$c$, ARRAY[ARRAY[pg_temp.nid($c$Physics$c$), pg_temp.nid($c$Calculus$c$)]]),
    ($c$Anatomy and Physiology$c$, ARRAY[ARRAY[pg_temp.nid($c$Biology$c$)]]),
    ($c$Biology$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemistry$c$)]]),
    ($c$Biology Research Teams 1$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemistry$c$), $c$Completed Course Application$c$]]),
    ($c$Biology Research Teams 2$c$, ARRAY[ARRAY[pg_temp.nid($c$Biology Research Teams 1$c$)]]),
    ($c$Bioorganic Chemistry$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemistry$c$)]]),
    ($c$Chemical Engineering$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemistry$c$)]]),
    ($c$Chemistry Consulting$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemistry$c$), pg_temp.nid($c$Math 2$c$)]]),
    ($c$Drug Design$c$, ARRAY[ARRAY[pg_temp.nid($c$Chemical Engineering$c$)], ARRAY[pg_temp.nid($c$Bioorganic Chemistry$c$)]]),
    ($c$Immunology$c$, ARRAY[ARRAY[pg_temp.nid($c$Biology$c$)]]),
    ($c$Mechanisms of Cancer$c$, ARRAY[ARRAY[pg_temp.nid($c$Biology$c$)]]),
    ($c$Modern Physics$c$, ARRAY[ARRAY[pg_temp.nid($c$Physics$c$)]]),
    ($c$Optics & Astrophysics$c$, ARRAY[ARRAY[pg_temp.nid($c$Physics$c$)]]),
    ($c$Physics Research$c$, ARRAY[ARRAY[pg_temp.nid($c$Physics$c$), $c$Consent of Instructor$c$]]),
    ($c$Semiconductor Processes$c$, ARRAY[ARRAY[pg_temp.nid($c$Modern Physics$c$)]]),
    ($c$Sensory Neuroscience$c$, ARRAY[ARRAY[pg_temp.nid($c$Biology$c$)]]),
    ($c$Science Teaching Fellowship$c$, ARRAY[pg_temp.tf()]),

    -- SEL
    ($c$Social Emotional Learning 10$c$, ARRAY[ARRAY[pg_temp.nid($c$Social Emotional Learning 9$c$)]]),
    ($c$Social Emotional Learning 11$c$, ARRAY[ARRAY[pg_temp.nid($c$Social Emotional Learning 10$c$)]]),
    ($c$Social Emotional Learning 12: The Good Life$c$, ARRAY[ARRAY[pg_temp.nid($c$Social Emotional Learning 11$c$)]]),
    ($c$SEL Teaching Fellowship$c$, ARRAY[pg_temp.tf()])
) AS v(title, opts)
WHERE c.title = v.title
  AND c.school_id = (SELECT id FROM schools WHERE name = $c$The Nueva School$c$);

----------------------------------------------------------------------
-- 3. Corequisites
----------------------------------------------------------------------
UPDATE courses AS c
SET coreq_options = v.opts
FROM (
  VALUES
    ($c$Algebra Techniques$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 1$c$)]]),
    ($c$Core Mathematics Intensive X$c$, ARRAY[ARRAY[pg_temp.nid($c$Core Mathematics Intensive Y$c$)]]),
    ($c$Core Mathematics Intensive Y$c$, ARRAY[ARRAY[pg_temp.nid($c$Core Mathematics Intensive X$c$)]]),
    ($c$Bioorganic Chemistry$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    ($c$Chemical Engineering$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 3$c$)]]),
    -- Physics: "Math 2 (or Higher)" -> Math 2 OR the "or Higher" escape hatch
    ($c$Physics$c$, ARRAY[ARRAY[pg_temp.nid($c$Math 2$c$)], ARRAY[$c$or Higher$c$]])
) AS v(title, opts)
WHERE c.title = v.title
  AND c.school_id = (SELECT id FROM schools WHERE name = $c$The Nueva School$c$);

----------------------------------------------------------------------
-- 4. Verification — flag unresolved course references (NULL elements from a
--    missing title, or UUID-shaped text that matches no course). Free text is
--    ignored. An empty result set means everything resolved cleanly.
----------------------------------------------------------------------
SELECT c.title AS course, kind, elem AS unresolved_element
FROM courses c
JOIN schools s ON s.id = c.school_id AND s.name = $c$The Nueva School$c$
CROSS JOIN LATERAL (
  SELECT $c$prereq$c$ AS kind, e AS elem FROM unnest(c.prereq_options) AS e
  UNION ALL
  SELECT $c$coreq$c$  AS kind, e AS elem FROM unnest(c.coreq_options)  AS e
) AS refs
WHERE elem IS NULL
   OR (
     elem ~ $c$^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$$c$
     AND NOT EXISTS (SELECT 1 FROM courses x WHERE x.id::text = elem)
   );

COMMIT;
