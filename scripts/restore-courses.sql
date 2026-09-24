-- Restore corrupted text columns on `courses`.
--
-- The corruption replaced every word in title, short_description, and
-- long_description with case-matched 'atlas' across all 530 course rows.
-- All other columns (ids, grades, terms, subjects, department/teacher
-- links, prereq/coreq options, schedules, custom_prereq) were untouched,
-- so this file only rewrites the three text columns, keyed by course id.
-- Course ids are preserved: student bookmarks, submissions, completed and
-- enrolled courses keep working without changes.
--
-- Original text recovered from the seed scripts in git history:
--   scripts/nueva-school.sql + scripts/nueva-arts.sql (matched via the
--   corruption's case/digit/punctuation fingerprint + intact fields),
--   scripts/test-school.sql and scripts/test2-school.sql (fixed uuids).
--
-- Before restoring, section 0 closes the hole that allowed the corruption:
-- the anon/publishable key still had write access to the catalog tables
-- (scripts/teacher-auth.sql section 4 was not in effect). Teacher edits go
-- through /api/teacher-mutate with the service role, which is unaffected.
--
-- Everything runs in one transaction. Every check RAISEs on failure, which
-- rolls back the lockdown and the restore together.
--
-- Run once in the Supabase SQL Editor. Idempotent: re-running is a no-op.

BEGIN;

----------------------------------------------------------------------
-- 0. Lock down catalog tables: anon/authenticated may only SELECT
----------------------------------------------------------------------
ALTER TABLE public.schools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
  r record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['schools', 'departments', 'courses', 'teachers', 'terms']
  LOOP
    -- Table-level write grants. PUBLIC is included because anon inherits it.
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM anon, authenticated, PUBLIC',
      v_table
    );

    -- Column-level write grants survive a table-level REVOKE.
    FOR r IN
      SELECT DISTINCT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
        AND privilege_type IN ('INSERT', 'UPDATE')
    LOOP
      EXECUTE format('REVOKE %s (%I) ON TABLE public.%I FROM %s',
        r.privilege_type, r.column_name, v_table,
        CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.grantee) END);
    END LOOP;

    -- Any policy that is not SELECT-only (whatever its name).
    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
        AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, v_table);
    END LOOP;

    -- Keep the read path the apps rely on.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_select_' || v_table, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'anon_select_' || v_table, v_table
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

-- Verify the lockdown before touching any data.
DO $$
DECLARE
  v_table text;
  v_role text;
  v_priv text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['schools', 'departments', 'courses', 'teachers', 'terms']
  LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || v_table)::regclass) THEN
      RAISE EXCEPTION 'Lockdown failed: RLS is off on %', v_table;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table AND cmd <> 'SELECT'
    ) THEN
      RAISE EXCEPTION 'Lockdown failed: % still has a write policy', v_table;
    END IF;

    FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated']
    LOOP
      FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE']
      LOOP
        IF has_any_column_privilege(v_role, 'public.' || v_table, v_priv) THEN
          RAISE EXCEPTION 'Lockdown failed: % can still % %', v_role, v_priv, v_table;
        END IF;
      END LOOP;
      FOREACH v_priv IN ARRAY ARRAY['DELETE', 'TRUNCATE']
      LOOP
        IF has_table_privilege(v_role, 'public.' || v_table, v_priv) THEN
          RAISE EXCEPTION 'Lockdown failed: % can still % %', v_role, v_priv, v_table;
        END IF;
      END LOOP;
      IF NOT has_table_privilege(v_role, 'public.' || v_table, 'SELECT') THEN
        RAISE EXCEPTION 'Lockdown broke reads: % cannot SELECT %', v_role, v_table;
      END IF;
    END LOOP;
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 1. Restore course text
----------------------------------------------------------------------

UPDATE courses SET
  title = $rst$English 9$rst$,
  short_description = $rst$Foundations of literature and composition.$rst$,
  long_description = $rst$A full-year introduction to close reading, analytical writing, and discussion across genres.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000001';

UPDATE courses SET
  title = $rst$Creative Writing Workshop$rst$,
  short_description = $rst$Poetry, fiction, and craft.$rst$,
  long_description = $rst$A workshop-based elective exploring poetry and short fiction through drafting and peer critique.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000003';

UPDATE courses SET
  title = $rst$Algebra I$rst$,
  short_description = $rst$Linear and quadratic reasoning.$rst$,
  long_description = $rst$A full-year course covering expressions, equations, functions, and quadratics.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000011';

UPDATE courses SET
  title = $rst$Social Emotional Learning 10$rst$,
  short_description = $rst$A core course focusing on emotional regulation, distress tolerance, relationship skills, and civil discourse. Prereq: SEL 9.$rst$,
  long_description = $rst$Social-Emotional Learning is a core Upper School course that continues the focus on social-emotional learning, an integral part of teaching and learning at Nueva throughout all grade levels. Drawing on content from a variety of disciplines (psychology, philosophy, cognitive science, therapeutic practices, social science), the course combines intellectual discussion and new concepts with self-reflection and practice in how to use this knowledge to develop skills that serve you. In 10th grade, SEL focuses on emotional regulation, distress tolerance, relationship skills, and civil discourse, building on the 9th-grade work in ethics, communication, and identity development. Students deeply practice how to navigate emotional situations, reframe their emotional narratives, and habituate good practices around distress tolerance. In the second semester, we add relationship skills and mind-body knowledge, then combine these threads to practice civil discourse and the art of having hard conversations. Note: SEL 10 classes meet only once per week, providing students one additional free block each week. Prerequisites: Social Emotional Learning 9.$rst$
WHERE id = '3c96db4f-a723-4ab3-bea4-278a6ed4343c';

UPDATE courses SET
  title = $rst$AP Biology$rst$,
  short_description = $rst$Emphasis on college-level cellular processes, heredity, evolution, and ecology.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on college-level cellular processes, heredity, evolution, and ecology. Support structures include office hours, peer tutors, and optional extension problems for those who want more. A final project or exam asks students to integrate what they learned about college-level cellular processes, heredity, evolution, and ecology under modest time pressure.$rst$
WHERE id = '93cf4d35-30e1-4085-a1c0-39b036af173e';

UPDATE courses SET
  title = $rst$English 10$rst$,
  short_description = $rst$World literature and rhetoric.$rst$,
  long_description = $rst$A full-year survey of world literature with an emphasis on argument and rhetorical analysis.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000002';

UPDATE courses SET
  title = $rst$History Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired history course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'cbba5041-d813-4d08-a42d-007ef21f32ed';

UPDATE courses SET
  title = $rst$Journalism$rst$,
  short_description = $rst$Reporting for the student paper.$rst$,
  long_description = $rst$Students research, write, and edit articles for the school newspaper across two trimesters.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000004';

UPDATE courses SET
  title = $rst$Spanish 1$rst$,
  short_description = $rst$A yearlong course building a foundation in Spanish across interpersonal, presentational, and interpretive skills.$rst$,
  long_description = $rst$Spanish 1 is designed to build a foundation in the Spanish language, with a focus on developing students' skills in interpersonal communication, presentational speaking and writing, and interpretive reading and listening. Comprehensible and repetitive exposure to high-frequency structures is provided through visuals, physical activities, stories, readings, and conversations about students and their lives, while making space for comparisons and connections with the cultures of Spanish-speaking countries. Students understand the benefits of learning a second language and the skills needed for successful acquisition, broadening perspectives about communities near and far. They learn to introduce themselves, describe their passions and interests, and describe themselves and their friends. As they explore cultural traditions related to homes and families, students describe different types of families, roles, and activities. As the year progresses, students construct and respond to questions and become storytellers, retelling and adapting real and imaginary stories.$rst$
WHERE id = 'a9ca3fc5-f3e2-4d32-a99b-a047b9a92b53';

UPDATE courses SET
  title = $rst$Biology$rst$,
  short_description = $rst$Lab- and project-driven work on cell biology, genetics, evolution, ecology, and laboratory investigation.$rst$,
  long_description = $rst$What looks like a narrow topic—cell biology, genetics, evolution, ecology, and laboratory investigation—becomes a route into bigger questions about evidence and craft. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in cell biology, genetics, evolution, ecology, and laboratory investigation clearly and apply them without a scripted worksheet.$rst$
WHERE id = '48f02bd3-bf5f-4b58-b052-74771c89b413';

UPDATE courses SET
  title = $rst$Interdisciplinary Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'f113de74-1010-4b21-aacb-f85774564b75';

UPDATE courses SET
  title = $rst$Precalculus with Trigonometry$rst$,
  short_description = $rst$Lab- and project-driven work on function analysis reinforced by sustained trigonometric practice.$rst$,
  long_description = $rst$Graphing tools and written justification are both expected when students present work on function analysis reinforced by sustained trigonometric practice. The teacher conferences mid-term to adjust challenge level without watering down standards. By the end, students should explain key ideas in function analysis reinforced by sustained trigonometric practice clearly and apply them without a scripted worksheet.$rst$
WHERE id = '9296d7bc-56b2-408b-974a-ec480bd567eb';

UPDATE courses SET
  title = $rst$Poetry and Poetics$rst$,
  short_description = $rst$Hands-on experience with poetic form, sound, imagery, interpretation, and original composition.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into poetic form, sound, imagery, interpretation, and original composition, others synthesize. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Later courses in the department will assume familiarity with poetic form, sound, imagery, interpretation, and original composition.$rst$
WHERE id = '45dc0929-d319-4744-9bfc-30c6ec65f38a';

UPDATE courses SET
  title = $rst$Modern Physics$rst$,
  short_description = $rst$Builds on first-year physics, covering developments from the late 19th century to today. Prereq: Physics.$rst$,
  long_description = $rst$This course builds on the first-year introduction to physics and generally covers developments from the late 19th century through the present day. Transitioning from the relatively intuitive principles of classical physics, students explore the more conceptually profound and challenging ideas demanded by 20th- and 21st-century science. Students study phenomena experimentally whenever practical; when a phenomenon is not tractable to classroom demonstration, digital simulations are employed. Students explore new content primarily through teacher-created screencasts and readings, with some Socratic lecture and classroom discussion, and spend most of their classroom time learning to solve problems, design and perform experiments, and analyze demonstrations of (sometimes unexpected) results. Topics include electromagnetism, relativity, nuclear physics, quantum physics, and the standard model of particle physics. Prerequisites: Physics.$rst$
WHERE id = '7ad04487-3c38-430f-84be-3946541c71fb';

UPDATE courses SET
  title = $rst$Independent Study: Internship$rst$,
  short_description = $rst$Transcript credit for juniors and seniors engaging in meaningful, experiential learning with an outside organization.$rst$,
  long_description = $rst$The Independent Study: Internship is an opportunity for Nueva juniors and seniors to receive transcript credit for engaging in meaningful, experiential learning with an organization outside of the curricular offerings. Students may elect to take it during the fall or spring semester, or both. The credit must be in place of an elective or during a free period; students may not receive it on top of a full course load. In addition to meeting expectations set by a manager, students should plan on meeting with the internship coordinator and other internship students regularly throughout the semester. Internship requirements include a minimum of 4 hours per week of work (paid or unpaid) and that the position provides learning not possible through existing Nueva curricular offerings. Interested students should contact the internship coordinator before the second and final add/drop period closes.$rst$
WHERE id = 'aa9323a4-4bd3-43df-a684-e7bdec06a3dc';

UPDATE courses SET
  title = $rst$AP Calculus$rst$,
  short_description = $rst$Differential and integral calculus.$rst$,
  long_description = $rst$A rigorous full-year calculus course preparing students for the AP examination.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000015';

UPDATE courses SET
  title = $rst$Literature of the African Diaspora$rst$,
  short_description = $rst$Reading, writing, and analysis focused on diasporic identity, memory, resistance, and literary innovation.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how diasporic identity, memory, resistance, and literary innovation is used. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about diasporic identity, memory, resistance, and literary innovation under modest time pressure.$rst$
WHERE id = 'bccad355-75aa-48cb-bf21-1776343b2eef';

UPDATE courses SET
  title = $rst$Music Ensemble$rst$,
  short_description = $rst$Perform as an ensemble.$rst$,
  long_description = $rst$A full-year performance ensemble rehearsing and presenting concerts each trimester.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000055';

UPDATE courses SET
  title = $rst$Theater Production$rst$,
  short_description = $rst$Stage a full production.$rst$,
  long_description = $rst$A two-trimester course producing a full theatrical performance, from auditions to opening night.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000056';

UPDATE courses SET
  title = $rst$Intro to Computer Science$rst$,
  short_description = $rst$Programming fundamentals.$rst$,
  long_description = $rst$A single-trimester introduction to programming, control flow, and problem decomposition.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000041';

UPDATE courses SET
  title = $rst$Chemistry$rst$,
  short_description = $rst$Matter, reactions, and bonding.$rst$,
  long_description = $rst$A full-year laboratory course on atomic structure, bonding, reactions, and stoichiometry.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000022';

UPDATE courses SET
  title = $rst$Physics$rst$,
  short_description = $rst$Motion, energy, and fields.$rst$,
  long_description = $rst$A full-year laboratory course spanning mechanics, energy, waves, and electromagnetism.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000023';

UPDATE courses SET
  title = $rst$US History$rst$,
  short_description = $rst$The American experience.$rst$,
  long_description = $rst$A full-year study of United States history from the colonial period to the present.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000032';

UPDATE courses SET
  title = $rst$Data Structures$rst$,
  short_description = $rst$Organizing and processing data.$rst$,
  long_description = $rst$A two-trimester course on lists, trees, graphs, and algorithmic complexity.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000042';

UPDATE courses SET
  title = $rst$Environmental Science$rst$,
  short_description = $rst$Systems, climate, and sustainability.$rst$,
  long_description = $rst$A single-trimester elective examining ecosystems, climate change, and human impact.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000024';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Foundations of visual art.$rst$,
  long_description = $rst$A single-trimester studio introducing drawing, color, and composition. Offered each trimester.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000053';

UPDATE courses SET
  title = $rst$Studio Art II$rst$,
  short_description = $rst$Advanced studio practice.$rst$,
  long_description = $rst$A two-trimester studio building on Studio Art I with a portfolio of independent work.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000054';

UPDATE courses SET
  title = $rst$Psychology$rst$,
  short_description = $rst$Mind and behavior.$rst$,
  long_description = $rst$A single-trimester elective surveying cognition, development, and social psychology.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000034';

UPDATE courses SET
  title = $rst$Machine Learning$rst$,
  short_description = $rst$Models that learn from data.$rst$,
  long_description = $rst$A two-trimester capstone elective covering regression, classification, and neural networks.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000045';

UPDATE courses SET
  title = $rst$Web Development II$rst$,
  short_description = $rst$Covers component interfaces, APIs, state management, testing, and performance.$rst$,
  long_description = $rst$What looks like a narrow topic—component interfaces, APIs, state management, testing, and performance—becomes a route into bigger questions about evidence and craft. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A working program or project demo anchors the final weeks' focus on component interfaces, APIs, state management, testing, and performance.$rst$
WHERE id = '06808207-c1a4-436a-8205-007d35b61fcb';

UPDATE courses SET
  title = $rst$Web Development$rst$,
  short_description = $rst$Building for the browser.$rst$,
  long_description = $rst$A single-trimester elective on HTML, CSS, and JavaScript, culminating in a small web app.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000044';

UPDATE courses SET
  title = $rst$Web Development$rst$,
  short_description = $rst$Building for the browser.$rst$,
  long_description = $rst$A single-trimester elective on HTML, CSS, and JavaScript, culminating in a small web app.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000043';

UPDATE courses SET
  title = $rst$Statistics$rst$,
  short_description = $rst$Data, probability, and inference.$rst$,
  long_description = $rst$A single-trimester introduction to descriptive statistics, probability, and inference.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000016';

UPDATE courses SET
  title = $rst$Core Mathematics Intensive Y$rst$,
  short_description = $rst$The companion course to Core Mathematics Intensive X in the accelerated Math 2-3 Integrated Program. Prereq: Math 1 and department approval.$rst$,
  long_description = $rst$Core Mathematics Intensive Y is the companion course to Core Mathematics Intensive X and is taken concurrently as part of the Core Mathematics Intensive: Math 2-3 Integrated Program, a yearlong alternative pathway through Nueva's Core Mathematics program. The program integrates and reorders core content typically addressed across Math 2 and Math 3 into a single, coherent sequence that emphasizes mathematical reasoning, problem solving, modeling, and clear communication of ideas. Enrollment in this course requires concurrent enrollment in Core Mathematics Intensive X. Placement is determined by department approval based on demonstrated readiness for sustained acceleration. Prerequisites: Math 1 and Math Department Approval. Corequisites: Core Mathematics Intensive X.$rst$
WHERE id = '92bdd83e-ee7e-44ba-8a39-9a89088b4bcd';

UPDATE courses SET
  title = $rst$Math Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired math course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '69a52afb-76df-4e0b-b3c2-19a6e0654b6e';

UPDATE courses SET
  title = $rst$Biology$rst$,
  short_description = $rst$Cells, genetics, and ecology.$rst$,
  long_description = $rst$A full-year laboratory course covering cellular biology, genetics, evolution, and ecology.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000021';

UPDATE courses SET
  title = $rst$Algebra I$rst$,
  short_description = $rst$Linear equations, functions, and algebraic modeling.$rst$,
  long_description = $rst$Field-adjacent examples keep linear equations, functions, and algebraic modeling connected to situations students recognize outside school. Support structures include office hours, peer tutors, and optional extension problems for those who want more. By the end, students should explain key ideas in linear equations, functions, and algebraic modeling clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'f7c7b4e6-c7eb-4a97-a7f5-c5e591e716fe';

UPDATE courses SET
  title = $rst$Mathematics Research Seminar$rst$,
  short_description = $rst$Covers independent conjecture, literature review, proof, and exposition.$rst$,
  long_description = $rst$The term opens with concrete problems tied to independent conjecture, literature review, proof, and exposition, then widens toward independent work. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. By the end, students should explain key ideas in independent conjecture, literature review, proof, and exposition clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'b9c16ab2-8035-4b11-8e1b-9ab74d84f799';

UPDATE courses SET
  title = $rst$Honors Algebra I$rst$,
  short_description = $rst$Accelerated algebraic reasoning and multi-step function problems.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to accelerated algebraic reasoning and multi-step function problems and for revising unfinished work. Support structures include office hours, peer tutors, and optional extension problems for those who want more. A final project or exam asks students to integrate what they learned about accelerated algebraic reasoning and multi-step function problems under modest time pressure.$rst$
WHERE id = 'd0d77e92-bd6f-4f31-abf5-4afa5aee2d0f';

UPDATE courses SET
  title = $rst$Trigonometry$rst$,
  short_description = $rst$A practical look at circular functions, identities, and triangle applications.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around circular functions, identities, and triangle applications. The teacher conferences mid-term to adjust challenge level without watering down standards.$rst$
WHERE id = 'f2fa7e69-e01c-4aca-8749-499d873046f7';

UPDATE courses SET
  title = $rst$Integrated Math I$rst$,
  short_description = $rst$A practical look at an integrated foundation in algebra, geometry, and data.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into an integrated foundation in algebra, geometry, and data, others synthesize. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about an integrated foundation in algebra, geometry, and data under modest time pressure.$rst$
WHERE id = 'aeb1e35a-4645-43c2-a61c-b8f984a5cac6';

UPDATE courses SET
  title = $rst$Integrated Math II$rst$,
  short_description = $rst$Lab- and project-driven work on quadratics, similarity, right-triangle trigonometry, and probability.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to quadratics, similarity, right-triangle trigonometry, and probability. Group roles rotate so no one is permanently the scribe or the spokesperson. Later courses in the department will assume familiarity with quadratics, similarity, right-triangle trigonometry, and probability.$rst$
WHERE id = 'ba33aea6-ccf5-40ad-9ecc-8fd25e4ebc9d';

UPDATE courses SET
  title = $rst$Adv. Studio Art$rst$,
  short_description = $rst$A yearlong upper-division studio class for students building a cohesive art portfolio across mediums. Prereq: any two full visual art courses (Intro & Advanced).$rst$,
  long_description = $rst$Advanced Studio Art is a class for students who want to continue making art and are interested in building a portfolio. Students in this upper division class will have taken an art class before and will drive their own exploration and art making. Students will have the opportunity to work in a community of other students who are committed to making and discussing art. Over the course of the semester, students will choose artistic research interests and make work based on those interests. This studio class will be focused on critique of student work in addition to making work; discussions and readings will provide a frame for the critiques. An emphasis will also be placed on larger portfolio goals, and students will work toward achieving a cohesive portfolio with depth in addition to breadth. Students will work across mediums, according to their interest and portfolio needs. Advanced Studio Art students will be expected to participate in the arts culmination at the end of the semester. Prerequisites: Any 2 full visual art courses (Intro & Advanced).$rst$
WHERE id = 'e7e6e1b2-92bb-406e-bd4a-6884c5af087f';

UPDATE courses SET
  title = $rst$Exponential and Logarithmic Functions$rst$,
  short_description = $rst$Term work on growth, decay, logarithmic equations, and applied models.$rst$,
  long_description = $rst$Graphing tools and written justification are both expected when students present work on growth, decay, logarithmic equations, and applied models. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'a8978b6e-9f2b-4864-9453-a035b3515eff';

UPDATE courses SET
  title = $rst$Geometry and Construction$rst$,
  short_description = $rst$Compass-and-straightedge constructions supported by proof.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to compass-and-straightedge constructions supported by proof until ideas feel usable. Students annotate their own errors and resubmit selected pieces after feedback. By the end, students should explain key ideas in compass-and-straightedge constructions supported by proof clearly and apply them without a scripted worksheet.$rst$
WHERE id = '055faed0-cb08-419a-9e79-483f61728b76';

UPDATE courses SET
  title = $rst$Intro to Psychology$rst$,
  short_description = $rst$An introduction to psychology, examining behavior through biological, cognitive, and social-cultural factors.$rst$,
  long_description = $rst$Does digital technology change our thinking? Why do art and music affect people differently? Can we predict who a person will be attracted to? How does a person form an identity? Can trauma be inherited? What are the roots of prejudice? Answers to questions like these can be found in the field of psychology. Contemporary psychology posits that the way humans act and think is shaped by the interaction among biological, cognitive, and social-cultural factors. In this elective, students critically examine research related to certain behaviors; learn fundamental theories such as schema theory and social identity theory; write analytical essays; participate in seminar-style discussions; and create individual and group projects such as podcasts, games, and films on topics of their choice. By the end of the course, students have a good grounding in the field for future study, understand the strengths and limitations of studying human behavior, and develop an appreciation for the ways humans act and think.$rst$
WHERE id = '925a5fb5-ca12-497a-997d-c1fafdb427a6';

UPDATE courses SET
  title = $rst$Honors Chemistry$rst$,
  short_description = $rst$Emphasis on advanced atomic theory, equilibrium, thermochemistry, and quantitative labs.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around advanced atomic theory, equilibrium, thermochemistry, and quantitative labs. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A lab practical or investigation write-up demonstrates command of advanced atomic theory, equilibrium, thermochemistry, and quantitative labs.$rst$
WHERE id = 'b6cd2e2d-ad84-45e9-84cf-9afbf1396755';

UPDATE courses SET
  title = $rst$Calculus I$rst$,
  short_description = $rst$A practical look at college-level limits, derivatives, optimization, and curve analysis.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around college-level limits, derivatives, optimization, and curve analysis. Students annotate their own errors and resubmit selected pieces after feedback. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'b2f5a1dd-cb9f-4a6b-bed7-1239dbce2c54';

UPDATE courses SET
  title = $rst$Number Theory$rst$,
  short_description = $rst$Term work on primes, divisibility, modular arithmetic, and cryptography.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around primes, divisibility, modular arithmetic, and cryptography. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in primes, divisibility, modular arithmetic, and cryptography clearly and apply them without a scripted worksheet.$rst$
WHERE id = '88782c80-d609-406b-a755-344936ac3332';

UPDATE courses SET
  title = $rst$Social Emotional Learning 12: The Good Life$rst$,
  short_description = $rst$The final semester of SEL, framed around the question "What is the Good Life?" Prereq: SEL 11.$rst$,
  long_description = $rst$Social-Emotional Learning is a core Upper School course that continues the focus on social-emotional learning, an integral part of teaching and learning at Nueva throughout all grade levels. Drawing on content from a variety of disciplines (psychology, philosophy, cognitive science, therapeutic practices, social science), the course combines intellectual discussion and new concepts with self-reflection and practice in how to use this knowledge to develop skills that serve you. The final semester of SEL focuses on the good life. As their time at Nueva draws to a close, students have a chance to think about what they want to draw from their time and what they need moving forward into their futures. The theme of asking themselves "What is the Good Life?" frames both of these aspects. This semester of SEL is highly responsive to student concerns and ideas, nimbly following student questions about how to take SEL learning into their next endeavors. Note: SEL 12 classes meet only once per week, providing students one additional free block each week. Prerequisites: Social Emotional Learning 11.$rst$
WHERE id = 'c68139ee-367c-49a2-998b-880e54781a96';

UPDATE courses SET
  title = $rst$Competition Math$rst$,
  short_description = $rst$Creative contest strategies across algebra, geometry, and counting.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how creative contest strategies across algebra, geometry, and counting is used. Students leave with notes and graded work that document progress on creative contest strategies across algebra, geometry, and counting.$rst$
WHERE id = 'd548ad94-dea2-42a3-821f-77dfe3db65b9';

UPDATE courses SET
  title = $rst$Integrated Math III$rst$,
  short_description = $rst$Applied study of polynomial functions, trigonometry, and statistical reasoning.$rst$,
  long_description = $rst$The term opens with concrete problems tied to polynomial functions, trigonometry, and statistical reasoning, then widens toward independent work. Group roles rotate so no one is permanently the scribe or the spokesperson. Later courses in the department will assume familiarity with polynomial functions, trigonometry, and statistical reasoning.$rst$
WHERE id = '0e25c31a-f393-42a3-92e0-8766a8f099c7';

UPDATE courses SET
  title = $rst$Pre-Calculus$rst$,
  short_description = $rst$An elective built around advanced functions, trigonometry, and analytic geometry.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to advanced functions, trigonometry, and analytic geometry and for revising unfinished work. Students annotate their own errors and resubmit selected pieces after feedback. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '7e3d9b97-d699-4eb6-a0f7-7b570f6b2f8e';

UPDATE courses SET
  title = $rst$Mathematical Logic$rst$,
  short_description = $rst$A practical look at propositions, predicates, quantifiers, and proof structures.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to propositions, predicates, quantifiers, and proof structures. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '87e0ec54-1618-4fc6-bf2a-52b2a39bf77a';

UPDATE courses SET
  title = $rst$Latinx Literature$rst$,
  short_description = $rst$Lab- and project-driven work on bilingual expression, community, history, and narrative voice.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around bilingual expression, community, history, and narrative voice. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'b4d282ec-4a7e-4782-972f-70f48dd1e1ce';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Foundations of visual art.$rst$,
  long_description = $rst$A single-trimester studio introducing drawing, color, and composition. Offered each trimester.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000051';

UPDATE courses SET
  title = $rst$Matrix Algebra$rst$,
  short_description = $rst$For students ready to take on row reduction, matrix operations, systems, and transformations.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how row reduction, matrix operations, systems, and transformations is used. Students annotate their own errors and resubmit selected pieces after feedback. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '9ee3a7de-1986-428f-a0cf-cdbaac47af8b';

UPDATE courses SET
  title = $rst$Math for Data Science$rst$,
  short_description = $rst$Hands-on experience with vectors, matrices, regression, and computational data analysis.$rst$,
  long_description = $rst$The term opens with concrete problems tied to vectors, matrices, regression, and computational data analysis, then widens toward independent work. Support structures include office hours, peer tutors, and optional extension problems for those who want more.$rst$
WHERE id = 'c03e27ad-a7a6-47e1-b2a4-1b0a2c444ecc';

UPDATE courses SET
  title = $rst$Spanish 4$rst$,
  short_description = $rst$A yearlong thematic course refining oral and written Spanish, conducted entirely in Spanish. Prereq: Spanish 3.$rst$,
  long_description = $rst$The Spanish 4 curriculum refines and enhances students' language skills, developing their ability to communicate effectively in oral and written Spanish within a thematic context. Students move toward less structure and more cumulative knowledge and self-initiated responses. They broaden their understanding of cultures from Spanish-speaking communities around the world, relating them to their own experiences. The course focuses on six essential themes: global challenges, beauty and aesthetics, families and communities, personal and public identities, contemporary life, and science and technology. Students explore each theme through written and audio resources, acquire new vocabulary, and practice writing and speaking formally and informally. The course emphasizes the use of language for active communication and is conducted entirely in Spanish. Prerequisites: Spanish 3 or equivalent.$rst$
WHERE id = 'd67f0364-7db6-4be4-9132-b521033faf36';

UPDATE courses SET
  title = $rst$Topology for Explorers$rst$,
  short_description = $rst$Surfaces, continuity, invariants, and rubber-sheet geometry.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to surfaces, continuity, invariants, and rubber-sheet geometry until ideas feel usable. Support structures include office hours, peer tutors, and optional extension problems for those who want more.$rst$
WHERE id = '738204e7-acc4-41e6-988a-c861e4cf9669';

UPDATE courses SET
  title = $rst$Game Theory$rst$,
  short_description = $rst$A practical look at payoff matrices, strategic behavior, and equilibrium.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with payoff matrices, strategic behavior, and equilibrium as the spine of major assignments. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Later courses in the department will assume familiarity with payoff matrices, strategic behavior, and equilibrium.$rst$
WHERE id = '78807ae8-a121-4e41-b22d-cfc5b50c7337';

UPDATE courses SET
  title = $rst$Real Analysis Seminar$rst$,
  short_description = $rst$Hands-on experience with rigorous limits, continuity, convergence, and epsilon-delta reasoning.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into rigorous limits, continuity, convergence, and epsilon-delta reasoning, others synthesize. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'a6deaa5d-2206-478b-9d00-4145922d4bb9';

UPDATE courses SET
  title = $rst$AP Statistics$rst$,
  short_description = $rst$Covers data analysis, experimental design, probability, and inference.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with data analysis, experimental design, probability, and inference as the spine of major assignments. A final project or exam asks students to integrate what they learned about data analysis, experimental design, probability, and inference under modest time pressure.$rst$
WHERE id = '48b39fa4-21f9-42c8-aa2a-acdb2a528414';

UPDATE courses SET
  title = $rst$Honors Geometry$rst$,
  short_description = $rst$For students ready to take on rigorous proof writing, constructions, and geometric transformations.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to rigorous proof writing, constructions, and geometric transformations and for revising unfinished work. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about rigorous proof writing, constructions, and geometric transformations under modest time pressure.$rst$
WHERE id = '925bb5d2-cd84-4c32-a2cc-4941d4519b1a';

UPDATE courses SET
  title = $rst$Honors Algebra II$rst$,
  short_description = $rst$Hands-on experience with complex numbers, rational functions, and advanced modeling.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into complex numbers, rational functions, and advanced modeling, others synthesize. Later courses in the department will assume familiarity with complex numbers, rational functions, and advanced modeling.$rst$
WHERE id = '79d120a3-cdea-4852-9b0e-28d87ddb843f';

UPDATE courses SET
  title = $rst$Calculus II$rst$,
  short_description = $rst$Lab- and project-driven work on integration techniques, volumes, arc length, and sequences.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into integration techniques, volumes, arc length, and sequences, others synthesize. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Later courses in the department will assume familiarity with integration techniques, volumes, arc length, and sequences.$rst$
WHERE id = '00008e6c-3ee8-48cc-aff6-138d206ef035';

UPDATE courses SET
  title = $rst$Statistics$rst$,
  short_description = $rst$Core work includes descriptive statistics, regression, probability, and basic inference.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with descriptive statistics, regression, probability, and basic inference, moving between explanation, practice, and critique. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '4d5130c4-e18b-4ce3-a7ba-88620068cd4f';

UPDATE courses SET
  title = $rst$Algebra II$rst$,
  short_description = $rst$Covers quadratics, polynomials, exponentials, and logarithms.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to quadratics, polynomials, exponentials, and logarithms. Students annotate their own errors and resubmit selected pieces after feedback. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '9352533d-9b5c-49ea-8426-6d64b653827e';

UPDATE courses SET
  title = $rst$AP Calculus BC$rst$,
  short_description = $rst$For students ready to take on series, parametric curves, polar coordinates, and vector functions.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about series, parametric curves, polar coordinates, and vector functions. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'b98d1e11-081a-4919-a75d-add4adeb05f9';

UPDATE courses SET
  title = $rst$Applied Calculus$rst$,
  short_description = $rst$Rates of change and accumulation in business and life sciences.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how rates of change and accumulation in business and life sciences is used. Group roles rotate so no one is permanently the scribe or the spokesperson. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '0ca39c77-4966-4e9f-85ce-35d2b39e132a';

UPDATE courses SET
  title = $rst$Research Writing$rst$,
  short_description = $rst$Reading, writing, and analysis focused on inquiry design, source evaluation, citation, and extended academic prose.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how inquiry design, source evaluation, citation, and extended academic prose is used. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '362bb4aa-b285-4f2e-bc48-3ff8067ab597';

UPDATE courses SET
  title = $rst$Geometry$rst$,
  short_description = $rst$Term work on deductive proof, spatial reasoning, and geometric measurement.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around deductive proof, spatial reasoning, and geometric measurement. Students leave with notes and graded work that document progress on deductive proof, spatial reasoning, and geometric measurement.$rst$
WHERE id = 'a9541047-4970-45a2-a979-70d58f9b8909';

UPDATE courses SET
  title = $rst$Physical Education Foundations$rst$,
  short_description = $rst$Builds from fundamentals of fitness principles, movement skills, teamwork, and lifelong activity.$rst$,
  long_description = $rst$Students track personal goals while practicing fitness principles, movement skills, teamwork, and lifelong activity in progressive stations or small-sided games. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Students leave with personal routines they can continue outside class involving fitness principles, movement skills, teamwork, and lifelong activity.$rst$
WHERE id = '32b5e1f1-05b8-4765-8c4d-9732ffa3b58e';

UPDATE courses SET
  title = $rst$British Literature$rst$,
  short_description = $rst$Skills and concepts in British literary traditions from epic poetry to contemporary fiction.$rst$,
  long_description = $rst$Field-adjacent examples keep British literary traditions from epic poetry to contemporary fiction connected to situations students recognize outside school. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Students leave with notes and graded work that document progress on British literary traditions from epic poetry to contemporary fiction.$rst$
WHERE id = '39f05ac1-f83e-4b3d-9c33-22a0b2d6f6aa';

UPDATE courses SET
  title = $rst$Multivariable Calculus$rst$,
  short_description = $rst$Applied study of partial derivatives, multiple integrals, and vector calculus.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on partial derivatives, multiple integrals, and vector calculus. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'f0649d31-a7d4-4b84-a757-4f758674014b';

UPDATE courses SET
  title = $rst$SAT Math Prep$rst$,
  short_description = $rst$Covers timed mathematical reasoning, test strategy, and error analysis.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around timed mathematical reasoning, test strategy, and error analysis. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Later courses in the department will assume familiarity with timed mathematical reasoning, test strategy, and error analysis.$rst$
WHERE id = '067a8e42-a980-424d-8fdb-4c077a46e312';

UPDATE courses SET
  title = $rst$Polynomial Functions$rst$,
  short_description = $rst$Emphasis on factoring, complex roots, end behavior, and graph structure.$rst$,
  long_description = $rst$Graphing tools and written justification are both expected when students present work on factoring, complex roots, end behavior, and graph structure. A final project or exam asks students to integrate what they learned about factoring, complex roots, end behavior, and graph structure under modest time pressure.$rst$
WHERE id = 'dbe510ae-df5c-422d-8f26-59ef10bb554e';

UPDATE courses SET
  title = $rst$Differential Equations$rst$,
  short_description = $rst$Skills and concepts in dynamic systems, slope fields, and numerical solution methods.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with dynamic systems, slope fields, and numerical solution methods, moving between explanation, practice, and critique. Group roles rotate so no one is permanently the scribe or the spokesperson.$rst$
WHERE id = '0acd1fda-42a7-4b17-bc2e-9095c0542039';

UPDATE courses SET
  title = $rst$AP Calculus AB$rst$,
  short_description = $rst$For students ready to take on limits, derivatives, integrals, and their applications.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with limits, derivatives, integrals, and their applications, moving between explanation, practice, and critique. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about limits, derivatives, integrals, and their applications under modest time pressure.$rst$
WHERE id = '145ca939-e15b-4795-a7eb-5e341b0df7e5';

UPDATE courses SET
  title = $rst$Graph Theory$rst$,
  short_description = $rst$Applied study of paths, trees, networks, coloring, and graph algorithms.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into paths, trees, networks, coloring, and graph algorithms, others synthesize. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'c1a7ce0e-b1e5-41a3-846a-4f4c18842633';

UPDATE courses SET
  title = $rst$Math Analysis$rst$,
  short_description = $rst$Hands-on experience with function behavior, inverse relationships, sequences, and limits.$rst$,
  long_description = $rst$Graphing tools and written justification are both expected when students present work on function behavior, inverse relationships, sequences, and limits. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Later courses in the department will assume familiarity with function behavior, inverse relationships, sequences, and limits.$rst$
WHERE id = '772e8813-5366-4951-b997-8c5dc33a7f7a';

UPDATE courses SET
  title = $rst$Quantitative Reasoning$rst$,
  short_description = $rst$Term work on data literacy, risk, voting systems, and fair division.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around data literacy, risk, voting systems, and fair division. Later courses in the department will assume familiarity with data literacy, risk, voting systems, and fair division.$rst$
WHERE id = '2d5d792f-abb0-417d-ba00-f04f0f5dc862';

UPDATE courses SET
  title = $rst$Literature and the Environment$rst$,
  short_description = $rst$For students ready to take on place writing, ecological imagination, and environmental justice.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about place writing, ecological imagination, and environmental justice. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. Later courses in the department will assume familiarity with place writing, ecological imagination, and environmental justice.$rst$
WHERE id = '018867c5-a4ca-42b4-93c7-f1f8e4620f83';

UPDATE courses SET
  title = $rst$Contemporary Fiction$rst$,
  short_description = $rst$Emphasis on recent novels, diverse narrators, form, and cultural debate.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with recent novels, diverse narrators, form, and cultural debate as the spine of major assignments. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. A final project or exam asks students to integrate what they learned about recent novels, diverse narrators, form, and cultural debate under modest time pressure.$rst$
WHERE id = '793e6af7-5c5a-4d70-93b1-c83824e46a6c';

UPDATE courses SET
  title = $rst$Detective Fiction$rst$,
  short_description = $rst$Lab- and project-driven work on mystery structure, clues, deduction, justice, and genre history.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around mystery structure, clues, deduction, justice, and genre history. By the end, students should explain key ideas in mystery structure, clues, deduction, justice, and genre history clearly and apply them without a scripted worksheet.$rst$
WHERE id = '62b1475d-65b8-45a7-87e5-61c0b2be19a9';

UPDATE courses SET
  title = $rst$Grammar and Style$rst$,
  short_description = $rst$Lab- and project-driven work on sentence craft, usage, punctuation, clarity, and rhetorical effect.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around sentence craft, usage, punctuation, clarity, and rhetorical effect. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Later courses in the department will assume familiarity with sentence craft, usage, punctuation, clarity, and rhetorical effect.$rst$
WHERE id = '2f1e1670-bbf7-4922-a332-410fda940d81';

UPDATE courses SET
  title = $rst$Advanced Composition$rst$,
  short_description = $rst$Reading, writing, and analysis focused on style, structure, revision, and writing for varied audiences.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how style, structure, revision, and writing for varied audiences is used. Students annotate their own errors and resubmit selected pieces after feedback. Students leave with notes and graded work that document progress on style, structure, revision, and writing for varied audiences.$rst$
WHERE id = '72ba0930-25cd-4447-b296-650bc093eaf5';

UPDATE courses SET
  title = $rst$Literary Magazine$rst$,
  short_description = $rst$Skills and concepts in editorial selection, copyediting, design, and creative publication.$rst$,
  long_description = $rst$Field-adjacent examples keep editorial selection, copyediting, design, and creative publication connected to situations students recognize outside school. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'd7aefffa-54f9-4bcd-adb2-b02f7438ecac';

UPDATE courses SET
  title = $rst$World Literature$rst$,
  short_description = $rst$Core work includes translated literature, cultural context, and comparative interpretation.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue translated literature, cultural context, and comparative interpretation in pairs and on their own. Support structures include office hours, peer tutors, and optional extension problems for those who want more. By the end, students should explain key ideas in translated literature, cultural context, and comparative interpretation clearly and apply them without a scripted worksheet.$rst$
WHERE id = '7567401a-9080-402d-a4b5-f64254054e39';

UPDATE courses SET
  title = $rst$Memoir and Personal Essay$rst$,
  short_description = $rst$Hands-on experience with memory, voice, scene, reflection, and ethical life writing.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into memory, voice, scene, reflection, and ethical life writing, others synthesize. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '53de5242-8b03-4c97-bf57-f644c3210d27';

UPDATE courses SET
  title = $rst$The Civil War and Reconstruction$rst$,
  short_description = $rst$Lab- and project-driven work on slavery, secession, warfare, emancipation, and contested reunion.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around slavery, secession, warfare, emancipation, and contested reunion. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students leave with notes and graded work that document progress on slavery, secession, warfare, emancipation, and contested reunion.$rst$
WHERE id = '60747626-260e-4374-b6e1-60e1bfe13b82';

UPDATE courses SET
  title = $rst$Journalism Lab$rst$,
  short_description = $rst$Core work includes collaborative reporting, editing, layout, and deadline-driven publication.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue collaborative reporting, editing, layout, and deadline-driven publication in pairs and on their own. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about collaborative reporting, editing, layout, and deadline-driven publication under modest time pressure.$rst$
WHERE id = '2420cb2c-ee73-4e62-a950-946b3dbb109c';

UPDATE courses SET
  title = $rst$Public Speaking$rst$,
  short_description = $rst$Reading, writing, and analysis focused on speech organization, delivery, audience analysis, and confidence.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how speech organization, delivery, audience analysis, and confidence is used. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '4c6d4144-e84f-461d-ab2a-c4812b6f606e';

UPDATE courses SET
  title = $rst$English 10$rst$,
  short_description = $rst$Emphasis on world literature, rhetorical analysis, and sustained academic writing.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with world literature, rhetorical analysis, and sustained academic writing as the spine of major assignments. Group roles rotate so no one is permanently the scribe or the spokesperson. Students leave with notes and graded work that document progress on world literature, rhetorical analysis, and sustained academic writing.$rst$
WHERE id = 'a39e0f13-b896-458e-8ecc-0753668fbc77';

UPDATE courses SET
  title = $rst$Journalism Lab$rst$,
  short_description = $rst$Core work includes collaborative reporting, editing, layout, and deadline-driven publication.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue collaborative reporting, editing, layout, and deadline-driven publication in pairs and on their own. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about collaborative reporting, editing, layout, and deadline-driven publication under modest time pressure.$rst$
WHERE id = '89731252-897c-4a53-9a58-55bb02a6a511';

UPDATE courses SET
  title = $rst$Mythology and Epic$rst$,
  short_description = $rst$Skills and concepts in heroic traditions, archetypes, oral storytelling, and adaptation.$rst$,
  long_description = $rst$Field-adjacent examples keep heroic traditions, archetypes, oral storytelling, and adaptation connected to situations students recognize outside school. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. Later courses in the department will assume familiarity with heroic traditions, archetypes, oral storytelling, and adaptation.$rst$
WHERE id = '611e0088-06d8-4eb7-91ee-b08583a50e0e';

UPDATE courses SET
  title = $rst$Shakespeare$rst$,
  short_description = $rst$Reading, writing, and analysis focused on dramatic language, performance choices, history, and close reading.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how dramatic language, performance choices, history, and close reading is used. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Later courses in the department will assume familiarity with dramatic language, performance choices, history, and close reading.$rst$
WHERE id = '1913feb7-22b3-434a-9604-13ac65a0b05f';

UPDATE courses SET
  title = $rst$Modern Drama$rst$,
  short_description = $rst$Core work includes twentieth-century plays, staging, dialogue, and social conflict.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue twentieth-century plays, staging, dialogue, and social conflict in pairs and on their own. The teacher conferences mid-term to adjust challenge level without watering down standards. Later courses in the department will assume familiarity with twentieth-century plays, staging, dialogue, and social conflict.$rst$
WHERE id = '910bf10b-c31e-4e7f-afe3-e9d505be5435';

UPDATE courses SET
  title = $rst$Argument and Persuasion$rst$,
  short_description = $rst$Emphasis on logical claims, credible evidence, counterargument, and civic rhetoric.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with logical claims, credible evidence, counterargument, and civic rhetoric as the spine of major assignments. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '7db47da3-df0d-41b2-9ac5-b41226a75ff9';

UPDATE courses SET
  title = $rst$Queer Literature$rst$,
  short_description = $rst$Emphasis on identity, community, genre, and LGBTQ+ literary histories.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with identity, community, genre, and LGBTQ+ literary histories as the spine of major assignments. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Students leave with notes and graded work that document progress on identity, community, genre, and LGBTQ+ literary histories.$rst$
WHERE id = '54baba04-2e7b-4ae4-af6c-efbb1a957578';

UPDATE courses SET
  title = $rst$Linear Algebra$rst$,
  short_description = $rst$Applied study of matrices, vector spaces, transformations, and eigenvalues.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with matrices, vector spaces, transformations, and eigenvalues as the spine of major assignments. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students leave with notes and graded work that document progress on matrices, vector spaces, transformations, and eigenvalues.$rst$
WHERE id = '68d2cda2-a0c1-462e-acea-234fca6dedca';

UPDATE courses SET
  title = $rst$Creative Writing Workshop$rst$,
  short_description = $rst$Hands-on experience with fiction, poetry, creative nonfiction, peer critique, and revision.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into fiction, poetry, creative nonfiction, peer critique, and revision, others synthesize. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Students leave with notes and graded work that document progress on fiction, poetry, creative nonfiction, peer critique, and revision.$rst$
WHERE id = '09e5f522-7936-47fd-ad48-44af33412d70';

UPDATE courses SET
  title = $rst$Young Adult Literature$rst$,
  short_description = $rst$Covers adolescent identity, genre conventions, readership, and critical response.$rst$,
  long_description = $rst$The term opens with concrete problems tied to adolescent identity, genre conventions, readership, and critical response, then widens toward independent work. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'f888466f-2022-4da8-ab5b-2da6b12c170e';

UPDATE courses SET
  title = $rst$Honors English 10$rst$,
  short_description = $rst$An elective built around comparative world literature and advanced evidence-based argument.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to comparative world literature and advanced evidence-based argument until ideas feel usable. Group roles rotate so no one is permanently the scribe or the spokesperson. Students leave with notes and graded work that document progress on comparative world literature and advanced evidence-based argument.$rst$
WHERE id = 'c31947b0-5dae-48c7-b309-71e921992b13';

UPDATE courses SET
  title = $rst$Satire and Comedy$rst$,
  short_description = $rst$Hands-on experience with irony, parody, comic form, cultural criticism, and performance.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into irony, parody, comic form, cultural criticism, and performance, others synthesize. Students leave with notes and graded work that document progress on irony, parody, comic form, cultural criticism, and performance.$rst$
WHERE id = '4416bbf4-d0ec-4174-b5bb-312921139a36';

UPDATE courses SET
  title = $rst$Native American Literature$rst$,
  short_description = $rst$Core work includes Indigenous storytelling, sovereignty, place, and contemporary writing.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue Indigenous storytelling, sovereignty, place, and contemporary writing in pairs and on their own. Students leave with notes and graded work that document progress on Indigenous storytelling, sovereignty, place, and contemporary writing.$rst$
WHERE id = '3c44943d-d55c-4aa5-ae03-5ec7f58cdba3';

UPDATE courses SET
  title = $rst$Graphic Novels$rst$,
  short_description = $rst$Seminar and studio approaches to sequential art, visual rhetoric, panel design, and literary interpretation.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that sequential art, visual rhetoric, panel design, and literary interpretation never stays only on a worksheet. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'b7a5920f-5743-46ea-a047-ccf8d89e6792';

UPDATE courses SET
  title = $rst$AP Physics 1$rst$,
  short_description = $rst$College-prep attention to algebra-based mechanics, energy, momentum, rotation, and waves.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue algebra-based mechanics, energy, momentum, rotation, and waves in pairs and on their own. Support structures include office hours, peer tutors, and optional extension problems for those who want more. A final project or exam asks students to integrate what they learned about algebra-based mechanics, energy, momentum, rotation, and waves under modest time pressure.$rst$
WHERE id = '12fd03cd-0342-4c65-bfaa-18d6e9a6b6d9';

UPDATE courses SET
  title = $rst$Paleontology$rst$,
  short_description = $rst$Applied study of fossils, evolution, ancient environments, and geological interpretation.$rst$,
  long_description = $rst$Safety, data notebooks, and uncertainty estimates sit alongside conceptual study of fossils, evolution, ancient environments, and geological interpretation. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Notebooks should show clean data practices alongside conceptual grasp of fossils, evolution, ancient environments, and geological interpretation.$rst$
WHERE id = 'ac12cce1-f35c-4044-b9c8-fab214a51cf1';

UPDATE courses SET
  title = $rst$AP English Language and Composition$rst$,
  short_description = $rst$Skills and concepts in rhetorical analysis, argument, synthesis, and nonfiction style.$rst$,
  long_description = $rst$Field-adjacent examples keep rhetorical analysis, argument, synthesis, and nonfiction style connected to situations students recognize outside school. Students annotate their own errors and resubmit selected pieces after feedback. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '4e77c8ed-3b08-45fe-b4dc-3b0cc132763f';

UPDATE courses SET
  title = $rst$Financial Mathematics$rst$,
  short_description = $rst$Attention to interest, annuities, amortization, risk, and investment.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue interest, annuities, amortization, risk, and investment in pairs and on their own. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. Later courses in the department will assume familiarity with interest, annuities, amortization, risk, and investment.$rst$
WHERE id = '687c9cf9-308c-4bf3-a09c-ba962e12f6cb';

UPDATE courses SET
  title = $rst$Earth Science$rst$,
  short_description = $rst$Skills and concepts in geology, weather, oceans, planetary systems, and field observation.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about geology, weather, oceans, planetary systems, and field observation. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. A lab practical or investigation write-up demonstrates command of geology, weather, oceans, planetary systems, and field observation.$rst$
WHERE id = 'eef0ba8b-6fd0-4fb6-a013-d03e213fe8e5';

UPDATE courses SET
  title = $rst$American Literature$rst$,
  short_description = $rst$Builds from fundamentals of American voices, literary movements, and national identity.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around American voices, literary movements, and national identity. Assessments mix short quizzes with performance tasks that look more like real work than trap questions.$rst$
WHERE id = '406f65f1-e4f4-44b2-9ebf-269dde68011e';

UPDATE courses SET
  title = $rst$Journalism$rst$,
  short_description = $rst$Lab- and project-driven work on news judgment, reporting, interviewing, and ethical publication.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around news judgment, reporting, interviewing, and ethical publication. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '13c4dbf7-27ba-4844-ab09-b30ab7922cfa';

UPDATE courses SET
  title = $rst$Honors English 9$rst$,
  short_description = $rst$Skills and concepts in accelerated literary analysis, seminar discussion, and polished prose.$rst$,
  long_description = $rst$Field-adjacent examples keep accelerated literary analysis, seminar discussion, and polished prose connected to situations students recognize outside school. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '2c105c69-38e1-4232-94cd-ae62b07830f8';

UPDATE courses SET
  title = $rst$Forensic Science$rst$,
  short_description = $rst$Lab- and project-driven work on evidence collection, trace analysis, toxicology, and scientific testimony.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into evidence collection, trace analysis, toxicology, and scientific testimony, others synthesize. Notebooks should show clean data practices alongside conceptual grasp of evidence collection, trace analysis, toxicology, and scientific testimony.$rst$
WHERE id = '3f66c4b3-ec02-4e0c-a165-0518a6edf2cf';

UPDATE courses SET
  title = $rst$Honors Physics$rst$,
  short_description = $rst$Applied study of calculus-ready mechanics, electricity, waves, and experimental modeling.$rst$,
  long_description = $rst$The term opens with concrete problems tied to calculus-ready mechanics, electricity, waves, and experimental modeling, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A lab practical or investigation write-up demonstrates command of calculus-ready mechanics, electricity, waves, and experimental modeling.$rst$
WHERE id = '37fb718a-c53a-4216-8f65-b77aaab7ce88';

UPDATE courses SET
  title = $rst$Lifetime Recreation$rst$,
  short_description = $rst$Builds from fundamentals of accessible recreational activities, wellness planning, and active leisure.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into accessible recreational activities, wellness planning, and active leisure, others synthesize. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Fitness logs and skill checklists show measurable improvement related to accessible recreational activities, wellness planning, and active leisure.$rst$
WHERE id = '9d3a0e80-c3a6-4df7-9710-7cfe6d5abe62';

UPDATE courses SET
  title = $rst$Organic Chemistry$rst$,
  short_description = $rst$A practical look at carbon compounds, functional groups, mechanisms, and synthesis.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on carbon compounds, functional groups, mechanisms, and synthesis. Reading loads stay manageable; the heavier lift is interpreting and producing original work. Notebooks should show clean data practices alongside conceptual grasp of carbon compounds, functional groups, mechanisms, and synthesis.$rst$
WHERE id = '8fd97c9f-133f-49d2-9f3b-e2022405f798';

UPDATE courses SET
  title = $rst$Anatomy and Physiology$rst$,
  short_description = $rst$Applied study of human body systems, structure, function, and clinical case studies.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around human body systems, structure, function, and clinical case studies. Students annotate their own errors and resubmit selected pieces after feedback. Notebooks should show clean data practices alongside conceptual grasp of human body systems, structure, function, and clinical case studies.$rst$
WHERE id = 'f815b153-210b-433f-8239-d68fd80890d0';

UPDATE courses SET
  title = $rst$Meteorology$rst$,
  short_description = $rst$Practice with atmospheric structure, forecasting, storms, climate, and weather data.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how atmospheric structure, forecasting, storms, climate, and weather data is used. Group roles rotate so no one is permanently the scribe or the spokesperson.$rst$
WHERE id = 'a74fb463-3ef7-46f6-9341-80856434f7d5';

UPDATE courses SET
  title = $rst$AP Chemistry$rst$,
  short_description = $rst$A practical look at college-level reactions, kinetics, equilibrium, thermodynamics, and analysis.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to college-level reactions, kinetics, equilibrium, thermodynamics, and analysis. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. By the end, students should explain key ideas in college-level reactions, kinetics, equilibrium, thermodynamics, and analysis clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'c5d9a11e-d3d1-4060-a9af-e4e69b606d8a';

UPDATE courses SET
  title = $rst$Science Research Seminar$rst$,
  short_description = $rst$Emphasis on experimental design, literature review, data analysis, and scientific communication.$rst$,
  long_description = $rst$What looks like a narrow topic—experimental design, literature review, data analysis, and scientific communication—becomes a route into bigger questions about evidence and craft. By the end, students should explain key ideas in experimental design, literature review, data analysis, and scientific communication clearly and apply them without a scripted worksheet.$rst$
WHERE id = '1e2a0044-908e-4f11-aa38-1872ee9a1688';

UPDATE courses SET
  title = $rst$Neuroscience$rst$,
  short_description = $rst$Builds from fundamentals of neural communication, brain systems, behavior, and research methods.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around neural communication, brain systems, behavior, and research methods. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. A lab practical or investigation write-up demonstrates command of neural communication, brain systems, behavior, and research methods.$rst$
WHERE id = '5f427211-c34a-47df-b22b-07a64fcbc847';

UPDATE courses SET
  title = $rst$Advanced Cybersecurity$rst$,
  short_description = $rst$Lab- and project-driven work on penetration testing, incident response, forensics, and defensive engineering.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to penetration testing, incident response, forensics, and defensive engineering. Code reviews and write-ups show how students reasoned through problems in penetration testing, incident response, forensics, and defensive engineering.$rst$
WHERE id = 'ee83d626-7a2e-4033-a536-277a9cf3bce5';

UPDATE courses SET
  title = $rst$Chemistry$rst$,
  short_description = $rst$Attention to matter, bonding, reactions, stoichiometry, and experimental measurement.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to matter, bonding, reactions, stoichiometry, and experimental measurement and for revising unfinished work. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. By the end, students should explain key ideas in matter, bonding, reactions, stoichiometry, and experimental measurement clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'c2907d0d-6bf9-4f52-995b-a24dc8948075';

UPDATE courses SET
  title = $rst$Physics$rst$,
  short_description = $rst$Practice with motion, forces, energy, waves, electricity, and quantitative experiments.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to motion, forces, energy, waves, electricity, and quantitative experiments until ideas feel usable. A final project or exam asks students to integrate what they learned about motion, forces, energy, waves, electricity, and quantitative experiments under modest time pressure.$rst$
WHERE id = 'a2ba3f9e-277d-4c68-a8ff-1e16fe9ac923';

UPDATE courses SET
  title = $rst$Biochemistry$rst$,
  short_description = $rst$Builds from fundamentals of proteins, enzymes, metabolism, molecular structure, and laboratory analysis.$rst$,
  long_description = $rst$Safety, data notebooks, and uncertainty estimates sit alongside conceptual study of proteins, enzymes, metabolism, molecular structure, and laboratory analysis. Support structures include office hours, peer tutors, and optional extension problems for those who want more. By the end, students should explain key ideas in proteins, enzymes, metabolism, molecular structure, and laboratory analysis clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'c24c8742-4ee7-4dea-9cc0-4d82d6a44a7b';

UPDATE courses SET
  title = $rst$Renewable Energy Science$rst$,
  short_description = $rst$Lab- and project-driven work on solar, wind, storage, efficiency, and energy-system tradeoffs.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around solar, wind, storage, efficiency, and energy-system tradeoffs. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. A lab practical or investigation write-up demonstrates command of solar, wind, storage, efficiency, and energy-system tradeoffs.$rst$
WHERE id = '52c65954-f52e-421d-880f-b1997798f321';

UPDATE courses SET
  title = $rst$AP Environmental Science$rst$,
  short_description = $rst$Hands-on experience with ecosystems, resources, pollution, climate, and environmental policy.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around ecosystems, resources, pollution, climate, and environmental policy. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Notebooks should show clean data practices alongside conceptual grasp of ecosystems, resources, pollution, climate, and environmental policy.$rst$
WHERE id = '521f5104-bcbc-48c2-a2d1-23446ba8fa62';

UPDATE courses SET
  title = $rst$Genetics$rst$,
  short_description = $rst$For students ready to take on inheritance, gene expression, genomics, variation, and bioethics.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how inheritance, gene expression, genomics, variation, and bioethics is used. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Notebooks should show clean data practices alongside conceptual grasp of inheritance, gene expression, genomics, variation, and bioethics.$rst$
WHERE id = 'eb3e7cbf-c948-4970-8da4-f8fd87f6093a';

UPDATE courses SET
  title = $rst$Laboratory Techniques$rst$,
  short_description = $rst$Term work on measurement, instrumentation, safety, documentation, and quality control.$rst$,
  long_description = $rst$Safety, data notebooks, and uncertainty estimates sit alongside conceptual study of measurement, instrumentation, safety, documentation, and quality control. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in measurement, instrumentation, safety, documentation, and quality control clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'd402891f-eabe-447c-949f-e4cda3a61b38';

UPDATE courses SET
  title = $rst$Geology$rst$,
  short_description = $rst$Builds from fundamentals of minerals, rocks, plate tectonics, deep time, and landscape processes.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around minerals, rocks, plate tectonics, deep time, and landscape processes. A lab practical or investigation write-up demonstrates command of minerals, rocks, plate tectonics, deep time, and landscape processes.$rst$
WHERE id = 'e3b314ed-e8ef-474f-9abe-7aaf84442fc8';

UPDATE courses SET
  title = $rst$Astronomy$rst$,
  short_description = $rst$An elective built around stars, planets, galaxies, cosmology, and observational methods.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with stars, planets, galaxies, cosmology, and observational methods, moving between explanation, practice, and critique. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. By the end, students should explain key ideas in stars, planets, galaxies, cosmology, and observational methods clearly and apply them without a scripted worksheet.$rst$
WHERE id = '6c962a11-bc5e-4b79-b24c-68b5d703d7d1';

UPDATE courses SET
  title = $rst$Environmental Science$rst$,
  short_description = $rst$Attention to ecology, human impacts, conservation, and local field research.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about ecology, human impacts, conservation, and local field research. The teacher conferences mid-term to adjust challenge level without watering down standards. By the end, students should explain key ideas in ecology, human impacts, conservation, and local field research clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'dec58c07-7f05-4d37-896f-04326fec4bb4';

UPDATE courses SET
  title = $rst$AP Physics 2$rst$,
  short_description = $rst$Seminar and studio approaches to fluids, thermodynamics, electricity, magnetism, optics, and modern physics.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to fluids, thermodynamics, electricity, magnetism, optics, and modern physics until ideas feel usable. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. A lab practical or investigation write-up demonstrates command of fluids, thermodynamics, electricity, magnetism, optics, and modern physics.$rst$
WHERE id = '67d38d7f-6cfc-487e-a64d-f0e60d9321d5';

UPDATE courses SET
  title = $rst$Epidemiology$rst$,
  short_description = $rst$Hands-on experience with disease patterns, study design, public-health data, and intervention.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with disease patterns, study design, public-health data, and intervention as the spine of major assignments. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A lab practical or investigation write-up demonstrates command of disease patterns, study design, public-health data, and intervention.$rst$
WHERE id = '937f4310-d698-4e50-bddb-e1d5df60dfa5';

UPDATE courses SET
  title = $rst$Ecology$rst$,
  short_description = $rst$Seminar and studio approaches to populations, communities, ecosystems, field sampling, and conservation.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about populations, communities, ecosystems, field sampling, and conservation. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. A final project or exam asks students to integrate what they learned about populations, communities, ecosystems, field sampling, and conservation under modest time pressure.$rst$
WHERE id = '5ebb4bcf-9820-4005-a786-17a24bf18bfa';

UPDATE courses SET
  title = $rst$AP Physics C: Mechanics$rst$,
  short_description = $rst$Builds from fundamentals of calculus-based kinematics, forces, energy, momentum, and rotation.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to calculus-based kinematics, forces, energy, momentum, and rotation. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. A lab practical or investigation write-up demonstrates command of calculus-based kinematics, forces, energy, momentum, and rotation.$rst$
WHERE id = 'ae59d181-1fff-46fc-a860-e7ac5b7dd54b';

UPDATE courses SET
  title = $rst$Social Emotional Learning 11$rst$,
  short_description = $rst$A core course focused on decision-making and the variables that influence it. Prereq: SEL 10.$rst$,
  long_description = $rst$Social-Emotional Learning is a core Upper School course that continues the focus on social-emotional learning, an integral part of teaching and learning at Nueva throughout all grade levels. Drawing on content from a variety of disciplines (psychology, philosophy, cognitive science, therapeutic practices, social science), the course combines intellectual discussion and new concepts with self-reflection and practice in how to use this knowledge to develop skills that serve you. The focus of SEL in grade 11 is for students to engage more critically in the process of decision-making, and to be aware of the multiple variables that affect their decision-making. Diving into interdisciplinary considerations of what influences us—our emotions, reason, perception, language, and context—students start building an understanding of their own decision-making models, asking how it serves them and how to tailor it to particular scenarios. Note: SEL 11 classes meet only once per week, providing students one additional free block each week. Prerequisites: Social Emotional Learning 10.$rst$
WHERE id = '48b24ee0-a92e-456c-9233-e731cd58d799';

UPDATE courses SET
  title = $rst$Botany$rst$,
  short_description = $rst$An elective built around plant anatomy, physiology, classification, ecology, and cultivation.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with plant anatomy, physiology, classification, ecology, and cultivation, moving between explanation, practice, and critique. Notebooks should show clean data practices alongside conceptual grasp of plant anatomy, physiology, classification, ecology, and cultivation.$rst$
WHERE id = 'dbd8f39a-01e9-4737-a608-1311ebd6465d';

UPDATE courses SET
  title = $rst$Zoology$rst$,
  short_description = $rst$Animal diversity, anatomy, behavior, evolution, and classification.$rst$,
  long_description = $rst$Field-adjacent examples keep animal diversity, anatomy, behavior, evolution, and classification connected to situations students recognize outside school. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about animal diversity, anatomy, behavior, evolution, and classification under modest time pressure.$rst$
WHERE id = '3d2cf531-4333-48b8-a28d-d756843f7a3f';

UPDATE courses SET
  title = $rst$Honors Biology$rst$,
  short_description = $rst$Skills and concepts in accelerated molecular biology, genetics, evolution, and inquiry labs.$rst$,
  long_description = $rst$Labs are not add-ons: most weeks reserve time for designing, measuring, or analyzing work tied to accelerated molecular biology, genetics, evolution, and inquiry labs. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about accelerated molecular biology, genetics, evolution, and inquiry labs under modest time pressure.$rst$
WHERE id = '2dcb25b2-91cb-4c39-8a52-79af5d3f342d';

UPDATE courses SET
  title = $rst$Robotics Programming$rst$,
  short_description = $rst$Applied study of sensors, actuators, feedback, autonomous behavior, and team integration.$rst$,
  long_description = $rst$The term opens with concrete problems tied to sensors, actuators, feedback, autonomous behavior, and team integration, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A working program or project demo anchors the final weeks' focus on sensors, actuators, feedback, autonomous behavior, and team integration.$rst$
WHERE id = '106c2c86-80b7-4d5b-83b9-221882154da7';

UPDATE courses SET
  title = $rst$English 9$rst$,
  short_description = $rst$Covers close reading, analytical paragraphs, grammar, and research foundations.$rst$,
  long_description = $rst$The term opens with concrete problems tied to close reading, analytical paragraphs, grammar, and research foundations, then widens toward independent work. Later courses in the department will assume familiarity with close reading, analytical paragraphs, grammar, and research foundations.$rst$
WHERE id = '9b8ade0d-4069-4740-84a4-958ad890c229';

UPDATE courses SET
  title = $rst$Software Engineering$rst$,
  short_description = $rst$Hands-on experience with requirements, architecture, teamwork, testing, documentation, and maintenance.$rst$,
  long_description = $rst$Version control, readability, and testing habits are graded alongside correctness in requirements, architecture, teamwork, testing, documentation, and maintenance. The teacher conferences mid-term to adjust challenge level without watering down standards. A final project or exam asks students to integrate what they learned about requirements, architecture, teamwork, testing, documentation, and maintenance under modest time pressure.$rst$
WHERE id = '9b05fe4c-3498-43be-8bb0-53a8d641cd6e';

UPDATE courses SET
  title = $rst$Python Programming$rst$,
  short_description = $rst$Skills and concepts in Python syntax, functions, collections, testing, and small applications.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue Python syntax, functions, collections, testing, and small applications in pairs and on their own. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about Python syntax, functions, collections, testing, and small applications under modest time pressure.$rst$
WHERE id = '1e1d47f5-084b-4a8d-bc8b-f91f7a46ad1f';

UPDATE courses SET
  title = $rst$Mobile App Development$rst$,
  short_description = $rst$Emphasis on interface design, device APIs, persistence, testing, and release workflows.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around interface design, device APIs, persistence, testing, and release workflows. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about interface design, device APIs, persistence, testing, and release workflows under modest time pressure.$rst$
WHERE id = '566a6a67-437f-4b21-a487-c022a2eabc05';

UPDATE courses SET
  title = $rst$Competitive Programming$rst$,
  short_description = $rst$Hands-on experience with efficient algorithms, timed problem solving, testing, and code review.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around efficient algorithms, timed problem solving, testing, and code review. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Code reviews and write-ups show how students reasoned through problems in efficient algorithms, timed problem solving, testing, and code review.$rst$
WHERE id = '9b53c27a-3c33-4d76-a6b5-0756d4c48d7f';

UPDATE courses SET
  title = $rst$Java Programming$rst$,
  short_description = $rst$Builds from fundamentals of Java classes, control flow, collections, debugging, and application design.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with Java classes, control flow, collections, debugging, and application design as the spine of major assignments. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about Java classes, control flow, collections, debugging, and application design under modest time pressure.$rst$
WHERE id = '55fe3aa5-fa55-4ceb-b29a-7fdb95603adf';

UPDATE courses SET
  title = $rst$Intro to Computer Science$rst$,
  short_description = $rst$For students ready to take on algorithms, programming fundamentals, data, and responsible computing.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to algorithms, programming fundamentals, data, and responsible computing until ideas feel usable. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Code reviews and write-ups show how students reasoned through problems in algorithms, programming fundamentals, data, and responsible computing.$rst$
WHERE id = '8e95568c-ab36-48c7-9435-2b75320cd454';

UPDATE courses SET
  title = $rst$Game Programming$rst$,
  short_description = $rst$Lab- and project-driven work on game loops, physics, input, animation, and iterative level design.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to game loops, physics, input, animation, and iterative level design. Group roles rotate so no one is permanently the scribe or the spokesperson. A working program or project demo anchors the final weeks' focus on game loops, physics, input, animation, and iterative level design.$rst$
WHERE id = 'fec24fb5-47ef-4261-b5b5-bee35d0c8d20';

UPDATE courses SET
  title = $rst$Artificial Intelligence$rst$,
  short_description = $rst$Hands-on experience with search, classification, neural networks, evaluation, and AI ethics.$rst$,
  long_description = $rst$The term opens with concrete problems tied to search, classification, neural networks, evaluation, and AI ethics, then widens toward independent work. Group roles rotate so no one is permanently the scribe or the spokesperson. By the end, students should explain key ideas in search, classification, neural networks, evaluation, and AI ethics clearly and apply them without a scripted worksheet.$rst$
WHERE id = '000f24f4-7d49-44bc-b81f-6cf5e3b16bca';

UPDATE courses SET
  title = $rst$Database Design$rst$,
  short_description = $rst$Emphasis on relational modeling, SQL, normalization, transactions, and application data.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around relational modeling, SQL, normalization, transactions, and application data. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. A working program or project demo anchors the final weeks' focus on relational modeling, SQL, normalization, transactions, and application data.$rst$
WHERE id = '87384194-7eb9-462e-95f2-295a6d67b71f';

UPDATE courses SET
  title = $rst$Yoga Fitness$rst$,
  short_description = $rst$For students ready to take on posture, mobility, breath, balance, and mindful conditioning.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that posture, mobility, breath, balance, and mindful conditioning never stays only on a worksheet. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about posture, mobility, breath, balance, and mindful conditioning under modest time pressure.$rst$
WHERE id = '2cbfd884-5d14-45e5-b24c-b20b63f01d62';

UPDATE courses SET
  title = $rst$Human-Computer Interaction$rst$,
  short_description = $rst$An elective built around user research, prototyping, accessibility, usability, and interface evaluation.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that user research, prototyping, accessibility, usability, and interface evaluation never stays only on a worksheet. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Code reviews and write-ups show how students reasoned through problems in user research, prototyping, accessibility, usability, and interface evaluation.$rst$
WHERE id = '015d1b49-a940-4970-beda-2fa871f58f3c';

UPDATE courses SET
  title = $rst$AP Computer Science A$rst$,
  short_description = $rst$A practical look at object-oriented Java, algorithms, data structures, and program design.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on object-oriented Java, algorithms, data structures, and program design. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A working program or project demo anchors the final weeks' focus on object-oriented Java, algorithms, data structures, and program design.$rst$
WHERE id = 'aff74140-df9f-4d80-bf2e-3bb3493b574b';

UPDATE courses SET
  title = $rst$Operating Systems$rst$,
  short_description = $rst$For students ready to take on processes, memory, filesystems, concurrency, and system interfaces.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with processes, memory, filesystems, concurrency, and system interfaces, moving between explanation, practice, and critique. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about processes, memory, filesystems, concurrency, and system interfaces under modest time pressure.$rst$
WHERE id = '49a09935-27a1-408b-a788-096b63a8bf3f';

UPDATE courses SET
  title = $rst$Web Development I$rst$,
  short_description = $rst$Core work includes semantic HTML, modern CSS, JavaScript, accessibility, and deployment.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how semantic HTML, modern CSS, JavaScript, accessibility, and deployment is used. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. A final project or exam asks students to integrate what they learned about semantic HTML, modern CSS, JavaScript, accessibility, and deployment under modest time pressure.$rst$
WHERE id = '8fdc9306-2b12-4e06-979f-b15cc1aa61cf';

UPDATE courses SET
  title = $rst$Embedded Systems$rst$,
  short_description = $rst$Skills and concepts in microcontrollers, digital signals, device interfaces, and real-time code.$rst$,
  long_description = $rst$Field-adjacent examples keep microcontrollers, digital signals, device interfaces, and real-time code connected to situations students recognize outside school. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well.$rst$
WHERE id = '6ee21324-a111-40f9-bfd7-8965f8591e15';

UPDATE courses SET
  title = $rst$Computer Graphics$rst$,
  short_description = $rst$Applied study of raster images, vectors, transformations, rendering, and visual simulation.$rst$,
  long_description = $rst$The term opens with concrete problems tied to raster images, vectors, transformations, rendering, and visual simulation, then widens toward independent work. Reading loads stay manageable; the heavier lift is interpreting and producing original work. Code reviews and write-ups show how students reasoned through problems in raster images, vectors, transformations, rendering, and visual simulation.$rst$
WHERE id = '49c81897-675d-4296-bf01-e6fe4cc9f90b';

UPDATE courses SET
  title = $rst$Data Science$rst$,
  short_description = $rst$Applied study of data cleaning, visualization, statistics, coding, and reproducible analysis.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around data cleaning, visualization, statistics, coding, and reproducible analysis. Code reviews and write-ups show how students reasoned through problems in data cleaning, visualization, statistics, coding, and reproducible analysis.$rst$
WHERE id = 'b6bdcf10-33e1-4a68-90d2-241f9c27c3cd';

UPDATE courses SET
  title = $rst$Open Source Software$rst$,
  short_description = $rst$A practical look at version control, issue triage, collaborative development, and community norms.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with version control, issue triage, collaborative development, and community norms as the spine of major assignments. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about version control, issue triage, collaborative development, and community norms under modest time pressure.$rst$
WHERE id = 'd88714ef-8dab-4f43-917a-19441d20b1f4';

UPDATE courses SET
  title = $rst$Computer Science Capstone$rst$,
  short_description = $rst$Applied study of independent software planning, implementation, evaluation, and presentation.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around independent software planning, implementation, evaluation, and presentation. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Code reviews and write-ups show how students reasoned through problems in independent software planning, implementation, evaluation, and presentation.$rst$
WHERE id = 'f05fb3d4-8a48-430d-b031-6a12a876d7fa';

UPDATE courses SET
  title = $rst$History of Immigration$rst$,
  short_description = $rst$Emphasis on migration, law, labor, identity, exclusion, and community formation.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with migration, law, labor, identity, exclusion, and community formation as the spine of major assignments. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint.$rst$
WHERE id = '5c97f350-6190-415f-a2c6-bdd3769d6e36';

UPDATE courses SET
  title = $rst$Computer Networks$rst$,
  short_description = $rst$A practical look at protocols, routing, addressing, distributed communication, and network security.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into protocols, routing, addressing, distributed communication, and network security, others synthesize. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. A working program or project demo anchors the final weeks' focus on protocols, routing, addressing, distributed communication, and network security.$rst$
WHERE id = '63ac2d3f-f048-4a0c-a80b-d9bce2ab2437';

UPDATE courses SET
  title = $rst$Middle Eastern History$rst$,
  short_description = $rst$Skills and concepts in empires, religions, colonial borders, nationalism, and modern states.$rst$,
  long_description = $rst$Field-adjacent examples keep empires, religions, colonial borders, nationalism, and modern states connected to situations students recognize outside school. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Later courses in the department will assume familiarity with empires, religions, colonial borders, nationalism, and modern states.$rst$
WHERE id = '6583bd0d-8db9-47cc-887a-92cd5174a847';

UPDATE courses SET
  title = $rst$Machine Learning$rst$,
  short_description = $rst$Builds from fundamentals of feature design, supervised learning, validation, and model interpretation.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on feature design, supervised learning, validation, and model interpretation. Code reviews and write-ups show how students reasoned through problems in feature design, supervised learning, validation, and model interpretation.$rst$
WHERE id = '392771f4-fc91-4428-bf2c-68da35a5dd82';

UPDATE courses SET
  title = $rst$Math 1$rst$,
  short_description = $rst$Builds competency in mathematical reasoning, integrating geometry and algebra and building the language and foundations of mathematics.$rst$,
  long_description = $rst$This course builds students' competency in mathematical reasoning, focusing on generalizing patterns, building strong arguments, and finding multiple approaches to solving problems. Students learn to ask probing questions, reflect on their problem-solving process, and clearly communicate their findings. Students develop mathematical fluency by integrating geometry and algebra through rich introductions to geometric construction, formal proofs and notation, similarity and congruence, right triangle trigonometry, coordinate geometry, and unit circle trigonometry. Students also revisit and expand on their knowledge of forms of linear, quadratic, absolute value, and piecewise functions, with an introduction to function transformations and the library of essential parent functions and analysis of key features. The underlying focus for the year is on building the language and foundations of mathematics.$rst$
WHERE id = '34f27c4a-8f06-4d57-857c-5b415b535b86';

UPDATE courses SET
  title = $rst$African American History$rst$,
  short_description = $rst$An elective built around Black life, resistance, institution building, culture, and political struggle.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to Black life, resistance, institution building, culture, and political struggle until ideas feel usable. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about Black life, resistance, institution building, culture, and political struggle under modest time pressure.$rst$
WHERE id = '5406fa0e-e177-4e49-8119-78e0631fc80b';

UPDATE courses SET
  title = $rst$History of South Asia$rst$,
  short_description = $rst$Covers empires, religions, colonialism, partition, democracy, and regional change.$rst$,
  long_description = $rst$The term opens with concrete problems tied to empires, religions, colonialism, partition, democracy, and regional change, then widens toward independent work. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '07350c77-9022-4c10-881f-5bd40d1d0288';

UPDATE courses SET
  title = $rst$Military History$rst$,
  short_description = $rst$Attention to strategy, technology, logistics, leadership, and the human costs of war.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to strategy, technology, logistics, leadership, and the human costs of war and for revising unfinished work. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '69bd75c1-7be9-402d-9141-714a449245ce';

UPDATE courses SET
  title = $rst$Medieval History$rst$,
  short_description = $rst$Reading, writing, and analysis focused on feudal societies, religion, trade, migration, and cultural exchange.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how feudal societies, religion, trade, migration, and cultural exchange is used. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about feudal societies, religion, trade, migration, and cultural exchange under modest time pressure.$rst$
WHERE id = '86f8d276-4c92-43ea-b39e-6cc92b750a4c';

UPDATE courses SET
  title = $rst$LGBTQ+ History$rst$,
  short_description = $rst$Hands-on experience with identity, community, law, activism, culture, and historical memory.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into identity, community, law, activism, culture, and historical memory, others synthesize. By the end, students should explain key ideas in identity, community, law, activism, culture, and historical memory clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'c4e9fd9b-bd76-4062-b66f-6fdd9332096e';

UPDATE courses SET
  title = $rst$AP United States History$rst$,
  short_description = $rst$Hands-on experience with college-level American history, primary sources, argument, and historical synthesis.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into college-level American history, primary sources, argument, and historical synthesis, others synthesize. The teacher conferences mid-term to adjust challenge level without watering down standards. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'f3c8e421-cc9e-404e-93a6-11830a40c3d8';

UPDATE courses SET
  title = $rst$Modern European History$rst$,
  short_description = $rst$An elective built around revolution, industrialization, nationalism, empire, and integration.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to revolution, industrialization, nationalism, empire, and integration until ideas feel usable. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '86797664-a388-4346-aa28-e4b8fe0b7b8a';

UPDATE courses SET
  title = $rst$History of the Americas$rst$,
  short_description = $rst$Reading, writing, and analysis focused on comparative Indigenous, colonial, revolutionary, and national histories.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how comparative Indigenous, colonial, revolutionary, and national histories is used. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Students leave with notes and graded work that document progress on comparative Indigenous, colonial, revolutionary, and national histories.$rst$
WHERE id = '14f186b6-0cd5-40d3-a64f-850271234820';

UPDATE courses SET
  title = $rst$AP European History$rst$,
  short_description = $rst$Covers European political, social, intellectual, and economic change since 1450.$rst$,
  long_description = $rst$The term opens with concrete problems tied to European political, social, intellectual, and economic change since 1450, then widens toward independent work. Students annotate their own errors and resubmit selected pieces after feedback. By the end, students should explain key ideas in European political, social, intellectual, and economic change since 1450 clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'bcf92493-0455-4420-bb4c-50777b073676';

UPDATE courses SET
  title = $rst$Oral History Workshop$rst$,
  short_description = $rst$Builds from fundamentals of interviewing, archival context, transcription, ethics, and public storytelling.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around interviewing, archival context, transcription, ethics, and public storytelling. Students annotate their own errors and resubmit selected pieces after feedback.$rst$
WHERE id = 'bdfd622d-4566-46ff-ae5f-9dcaf0b7e7d1';

UPDATE courses SET
  title = $rst$Latin American History$rst$,
  short_description = $rst$Builds from fundamentals of Indigenous societies, conquest, independence, inequality, and social movements.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around Indigenous societies, conquest, independence, inequality, and social movements. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'b71e1c81-5690-4455-8bec-b165e255659c';

UPDATE courses SET
  title = $rst$The Cold War$rst$,
  short_description = $rst$Term work on ideology, diplomacy, proxy conflict, decolonization, and nuclear risk.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to ideology, diplomacy, proxy conflict, decolonization, and nuclear risk. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in ideology, diplomacy, proxy conflict, decolonization, and nuclear risk clearly and apply them without a scripted worksheet.$rst$
WHERE id = '72bcfe08-b0ce-442d-a333-1d4c5c5bf4c9';

UPDATE courses SET
  title = $rst$History Through Film$rst$,
  short_description = $rst$Applied study of historical interpretation, cinematic evidence, memory, and representation.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on historical interpretation, cinematic evidence, memory, and representation. Group roles rotate so no one is permanently the scribe or the spokesperson. By the end, students should explain key ideas in historical interpretation, cinematic evidence, memory, and representation clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'cec94e8f-6928-4437-a293-5d86ca2c562c';

UPDATE courses SET
  title = $rst$Spanish I$rst$,
  short_description = $rst$Attention to foundational Spanish conversation, listening, reading, writing, and culture.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to foundational Spanish conversation, listening, reading, writing, and culture and for revising unfinished work. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '67deb63f-c786-4efe-9af3-3f339a9cbf46';

UPDATE courses SET
  title = $rst$Local History Research$rst$,
  short_description = $rst$An elective built around archives, maps, material culture, community memory, and public history.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to archives, maps, material culture, community memory, and public history until ideas feel usable. Later courses in the department will assume familiarity with archives, maps, material culture, community memory, and public history.$rst$
WHERE id = '4ab33be5-68c4-44d8-af24-713934ba5b4f';

UPDATE courses SET
  title = $rst$Latin I$rst$,
  short_description = $rst$Lab- and project-driven work on classical vocabulary, grammar, translation, mythology, and Roman culture.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around classical vocabulary, grammar, translation, mythology, and Roman culture. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '1b6b34f3-c8b6-4a8f-913a-a36bd76eb453';

UPDATE courses SET
  title = $rst$Spanish III$rst$,
  short_description = $rst$Hands-on experience with intermediate Spanish fluency, authentic texts, and extended conversation.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into intermediate Spanish fluency, authentic texts, and extended conversation, others synthesize. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'cb942845-4591-49e3-8b03-bae76cb51641';

UPDATE courses SET
  title = $rst$Spanish II$rst$,
  short_description = $rst$Practice with expanding Spanish communication, narration, grammar, and cultural knowledge.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how expanding Spanish communication, narration, grammar, and cultural knowledge is used. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in expanding Spanish communication, narration, grammar, and cultural knowledge clearly and apply them without a scripted worksheet.$rst$
WHERE id = '8644b715-44c7-4c65-84c3-5c924fd28059';

UPDATE courses SET
  title = $rst$AP French Language and Culture$rst$,
  short_description = $rst$Core work includes college-level French communication, interpretation, and cultural comparison.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue college-level French communication, interpretation, and cultural comparison in pairs and on their own. A final project or exam asks students to integrate what they learned about college-level French communication, interpretation, and cultural comparison under modest time pressure.$rst$
WHERE id = 'e78e1340-e071-49a3-b1a9-4ecc24a21d7a';

UPDATE courses SET
  title = $rst$AP Chinese Language and Culture$rst$,
  short_description = $rst$An elective built around advanced Mandarin communication, interpretation, and cultural knowledge.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to advanced Mandarin communication, interpretation, and cultural knowledge until ideas feel usable. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about advanced Mandarin communication, interpretation, and cultural knowledge under modest time pressure.$rst$
WHERE id = 'b18c49e0-1661-4dd7-9ccb-c1ffc3273565';

UPDATE courses SET
  title = $rst$Algebra Techniques$rst$,
  short_description = $rst$Builds competency with algebraic fundamentals to support success in Math 1, in which students are dual-enrolled. Coreq: Math 1.$rst$,
  long_description = $rst$This course builds students' competency with the fundamentals of algebraic thinking and technique necessary for success across our mathematics and science programs. Students practice and solidify techniques such as order of operations, simplifying and manipulating algebraic expressions, symbolic manipulation, solving equations and inequalities with linear, absolute value, and quadratic components, and working with exponents and radicals. Along the way, students develop proficiency in recognizing structure, moving between representations in problem spaces, abstracting from repeated computations to the language of algebra, and moving between process and object views of mathematical concepts. Throughout the course, there is an emphasis on connecting this algebraic toolkit to geometric spaces and applied/contextual problems, supporting students in their Math 1 course, in which they are dual-enrolled. Corequisites: Math 1.$rst$
WHERE id = '9e026f9a-e780-4604-b1b5-aaf6ae326340';

UPDATE courses SET
  title = $rst$French I$rst$,
  short_description = $rst$Emphasis on foundational French communication, pronunciation, literacy, and Francophone cultures.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with foundational French communication, pronunciation, literacy, and Francophone cultures as the spine of major assignments. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'cacfde1d-074c-4dfa-84f2-d8b8b1225281';

UPDATE courses SET
  title = $rst$Latin III$rst$,
  short_description = $rst$Hands-on experience with advanced Latin prose and poetry, rhetoric, and historical context.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into advanced Latin prose and poetry, rhetoric, and historical context, others synthesize. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Later courses in the department will assume familiarity with advanced Latin prose and poetry, rhetoric, and historical context.$rst$
WHERE id = '350f17e1-f8ca-47b1-b64c-3b36bfabb014';

UPDATE courses SET
  title = $rst$French II$rst$,
  short_description = $rst$Emphasis on developing French narration, listening, grammar, and cultural understanding.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with developing French narration, listening, grammar, and cultural understanding as the spine of major assignments. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '659ab119-c42f-41c8-8485-1314246e7f6c';

UPDATE courses SET
  title = $rst$Spanish IV$rst$,
  short_description = $rst$Advanced Spanish discussion, composition, literature, and cultural analysis.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with advanced Spanish discussion, composition, literature, and cultural analysis, moving between explanation, practice, and critique. Support structures include office hours, peer tutors, and optional extension problems for those who want more. A final project or exam asks students to integrate what they learned about advanced Spanish discussion, composition, literature, and cultural analysis under modest time pressure.$rst$
WHERE id = 'b1310468-13a0-46aa-9d52-99fabdf81c9a';

UPDATE courses SET
  title = $rst$Latin II$rst$,
  short_description = $rst$A practical look at intermediate Latin syntax, translation strategies, history, and literature.$rst$,
  long_description = $rst$What looks like a narrow topic—intermediate Latin syntax, translation strategies, history, and literature—becomes a route into bigger questions about evidence and craft. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. By the end, students should explain key ideas in intermediate Latin syntax, translation strategies, history, and literature clearly and apply them without a scripted worksheet.$rst$
WHERE id = '75b52396-1dde-4217-a0cd-b53c162062b2';

UPDATE courses SET
  title = $rst$AP Spanish Language and Culture$rst$,
  short_description = $rst$Applied study of college-level Spanish communication, cultural comparison, and persuasive writing.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on college-level Spanish communication, cultural comparison, and persuasive writing. The teacher conferences mid-term to adjust challenge level without watering down standards. Students leave with notes and graded work that document progress on college-level Spanish communication, cultural comparison, and persuasive writing.$rst$
WHERE id = '98948415-1519-4b3d-91ad-fb84e0578af1';

UPDATE courses SET
  title = $rst$Mandarin Chinese I$rst$,
  short_description = $rst$Core work includes foundational Mandarin speaking, listening, characters, and cultural practices.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue foundational Mandarin speaking, listening, characters, and cultural practices in pairs and on their own. Students annotate their own errors and resubmit selected pieces after feedback. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '06cef436-7325-4f56-a3b3-accb3e235964';

UPDATE courses SET
  title = $rst$Mandarin Chinese II$rst$,
  short_description = $rst$Hands-on experience with developing Mandarin conversation, character literacy, and everyday communication.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into developing Mandarin conversation, character literacy, and everyday communication, others synthesize. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well.$rst$
WHERE id = 'e5a80c5a-4644-45f3-81a2-59bf01dcfeef';

UPDATE courses SET
  title = $rst$Graphic Design$rst$,
  short_description = $rst$Covers typography, layout, branding, hierarchy, and visual communication.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to typography, layout, branding, hierarchy, and visual communication. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Students finish able to describe artistic choices related to typography, layout, branding, hierarchy, and visual communication with specific language.$rst$
WHERE id = 'b253156c-64ae-48b3-81d4-c9dfb874c128';

UPDATE courses SET
  title = $rst$Printmaking$rst$,
  short_description = $rst$Lab- and project-driven work on relief, intaglio, screen printing, editions, and graphic composition.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on relief, intaglio, screen printing, editions, and graphic composition. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Students finish able to describe artistic choices related to relief, intaglio, screen printing, editions, and graphic composition with specific language.$rst$
WHERE id = 'da8e8877-e5b6-42fc-adf5-c3f3c1c0858c';

UPDATE courses SET
  title = $rst$Fashion Design$rst$,
  short_description = $rst$For students ready to take on textiles, garment concepts, sketching, construction, and sustainable design.$rst$,
  long_description = $rst$Studio / rehearsal time dominates; reflection journals document decisions related to textiles, garment concepts, sketching, construction, and sustainable design. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students finish able to describe artistic choices related to textiles, garment concepts, sketching, construction, and sustainable design with specific language.$rst$
WHERE id = '59170057-9023-40d2-b9a7-9e20e1212860';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Practice with drawing, painting, composition, observation, and creative process.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that drawing, painting, composition, observation, and creative process never stays only on a worksheet. Students annotate their own errors and resubmit selected pieces after feedback. Students finish able to describe artistic choices related to drawing, painting, composition, observation, and creative process with specific language.$rst$
WHERE id = '0bfc7be7-eba0-4ba5-8c17-57efb24694f0';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Practice with drawing, painting, composition, observation, and creative process.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that drawing, painting, composition, observation, and creative process never stays only on a worksheet. Students annotate their own errors and resubmit selected pieces after feedback. Students finish able to describe artistic choices related to drawing, painting, composition, observation, and creative process with specific language.$rst$
WHERE id = 'e80f5516-58fc-4b99-ab7a-f6843e251909';

UPDATE courses SET
  title = $rst$Advanced Probability$rst$,
  short_description = $rst$A calculus-based approach to random variables, classical distributions, limit theorems, and Markov chains. Prereq: Calculus.$rst$,
  long_description = $rst$This class takes a calculus-based approach to discrete and continuous random variables, Bernoulli and Poisson processes, probability generating functions, classical distributions (normal, t, binomial, hypergeometric, negative binomial, exponential, Poisson, beta, gamma), moments, joint distributions, multivariate normal distribution, conditional expectation, formalization of the law of large numbers, the central limit theorem, the theoretical basis of statistical tests, Markov chains, and branching processes. We develop an intuitive understanding of the processes underlying the notation, with an emphasis on clever, elegant problem-solving. We use programming and simulation-based investigations to understand distributions, moment calculations, and limit theorems. While largely theoretical, we develop probability theory with an eye toward seeking truth in understanding natural and social phenomena. Prerequisites: Calculus.$rst$
WHERE id = '0201c5d1-85ab-486c-8792-a626b579d52b';

UPDATE courses SET
  title = $rst$Film Photography$rst$,
  short_description = $rst$Hands-on experience with manual exposure, darkroom printing, composition, and photographic history.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on manual exposure, darkroom printing, composition, and photographic history. Group roles rotate so no one is permanently the scribe or the spokesperson. Students finish able to describe artistic choices related to manual exposure, darkroom printing, composition, and photographic history with specific language.$rst$
WHERE id = '92d7a1dd-a9c5-43ed-9ed5-ea4713edc2be';

UPDATE courses SET
  title = $rst$Mandarin Chinese III$rst$,
  short_description = $rst$Intermediate Mandarin fluency, authentic texts, and cultural discussion.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with intermediate Mandarin fluency, authentic texts, and cultural discussion, moving between explanation, practice, and critique. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'ead6f514-a61c-40d7-a340-bbb56b818d7c';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Practice with drawing, painting, composition, observation, and creative process.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that drawing, painting, composition, observation, and creative process never stays only on a worksheet. Students annotate their own errors and resubmit selected pieces after feedback. Students finish able to describe artistic choices related to drawing, painting, composition, observation, and creative process with specific language.$rst$
WHERE id = '7f770a80-ba4a-4592-96a5-6b125be34e92';

UPDATE courses SET
  title = $rst$American Sign Language I$rst$,
  short_description = $rst$Attention to foundational signing, receptive skills, Deaf culture, and visual grammar.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to foundational signing, receptive skills, Deaf culture, and visual grammar and for revising unfinished work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about foundational signing, receptive skills, Deaf culture, and visual grammar under modest time pressure.$rst$
WHERE id = '93d43719-bd50-4fe3-8547-631122967038';

UPDATE courses SET
  title = $rst$Studio Art II$rst$,
  short_description = $rst$Applied study of advanced studio techniques, personal voice, critique, and portfolio development.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around advanced studio techniques, personal voice, critique, and portfolio development. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about advanced studio techniques, personal voice, critique, and portfolio development under modest time pressure.$rst$
WHERE id = '66a500a6-3070-4f02-9468-e33c17c4813f';

UPDATE courses SET
  title = $rst$Drawing and Illustration$rst$,
  short_description = $rst$Seminar and studio approaches to observational drawing, visual storytelling, media, and illustration techniques.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to observational drawing, visual storytelling, media, and illustration techniques and for revising unfinished work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter.$rst$
WHERE id = '88b9b55b-d9fe-4645-9b19-021bf6d976cd';

UPDATE courses SET
  title = $rst$Hit Harmonics: Studio Recording from Idea to Record$rst$,
  short_description = $rst$A studio-based course exploring how songs are built and why they resonate, through analysis, ear training, and hands-on production.$rst$,
  long_description = $rst$Hit Harmonics is a studio-based music course exploring how songs are built and why they resonate. Through close listening, song analysis, ear training, lyric study, and hands-on production, students examine the rhythmic, harmonic, lyrical, melodic, and structural choices that shape emotional impact. Using the full capabilities of the Upper School recording studio, students analyze influential recordings and apply those insights through original compositions, creative reinterpretations, and the collaborative production of a class-built track. Throughout the semester, students contribute to a shared class sound library, developing a curated collection of grooves, harmonies, textures, and recorded material that becomes a living resource for composition. By semester's end, students will have produced finished works, including a collaborative class song, and developed a deeper understanding of how musical decisions shape the listener's experience.$rst$
WHERE id = '765c857f-3638-4aa6-8b1f-b942aa120875';

UPDATE courses SET
  title = $rst$Digital Photography$rst$,
  short_description = $rst$Builds from fundamentals of camera controls, composition, lighting, editing, and visual narrative.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to camera controls, composition, lighting, editing, and visual narrative. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students finish able to describe artistic choices related to camera controls, composition, lighting, editing, and visual narrative with specific language.$rst$
WHERE id = '9bc1b3e4-33f6-4b15-85be-c00b81321d16';

UPDATE courses SET
  title = $rst$Art History$rst$,
  short_description = $rst$Core work includes global visual traditions, formal analysis, context, and museum interpretation.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about global visual traditions, formal analysis, context, and museum interpretation. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in global visual traditions, formal analysis, context, and museum interpretation clearly and apply them without a scripted worksheet.$rst$
WHERE id = '7077209b-edac-4b75-8da4-f7d93d90ee5c';

UPDATE courses SET
  title = $rst$Digital Photography$rst$,
  short_description = $rst$Builds from fundamentals of camera controls, composition, lighting, editing, and visual narrative.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to camera controls, composition, lighting, editing, and visual narrative. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students finish able to describe artistic choices related to camera controls, composition, lighting, editing, and visual narrative with specific language.$rst$
WHERE id = 'e76ea6b0-869b-47b5-83f7-6441ff08c901';

UPDATE courses SET
  title = $rst$Digital Art$rst$,
  short_description = $rst$For students ready to take on raster and vector tools, digital painting, collage, and creative workflow.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how raster and vector tools, digital painting, collage, and creative workflow is used. The teacher conferences mid-term to adjust challenge level without watering down standards. Students finish able to describe artistic choices related to raster and vector tools, digital painting, collage, and creative workflow with specific language.$rst$
WHERE id = 'd7992e8e-d8f0-4c21-8c0b-a4f237f5ff50';

UPDATE courses SET
  title = $rst$Ceramics Studio$rst$,
  short_description = $rst$Attention to hand-building, wheel throwing, glazing, firing, and ceramic design.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue hand-building, wheel throwing, glazing, firing, and ceramic design in pairs and on their own. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A public or classroom showcase makes student work on hand-building, wheel throwing, glazing, firing, and ceramic design visible beyond the studio.$rst$
WHERE id = 'd6530a0d-20e9-47f1-8bfa-74ab5877e220';

UPDATE courses SET
  title = $rst$Outdoor Education$rst$,
  short_description = $rst$An elective built around navigation, low-impact travel, risk management, and environmental stewardship.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with navigation, low-impact travel, risk management, and environmental stewardship, moving between explanation, practice, and critique. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about navigation, low-impact travel, risk management, and environmental stewardship under modest time pressure.$rst$
WHERE id = '39c916e3-2e02-4528-ac32-bfc048126159';

UPDATE courses SET
  title = $rst$Soccer Skills$rst$,
  short_description = $rst$Attention to touch, passing, movement, defending, tactics, and match play.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how touch, passing, movement, defending, tactics, and match play is used. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. By the end, students should explain key ideas in touch, passing, movement, defending, tactics, and match play clearly and apply them without a scripted worksheet.$rst$
WHERE id = '8ef30103-e2fa-4eaf-b77f-b241f8643751';

UPDATE courses SET
  title = $rst$Personal Fitness$rst$,
  short_description = $rst$Applied study of goal setting, fitness assessment, training principles, and healthy routines.$rst$,
  long_description = $rst$The term opens with concrete problems tied to goal setting, fitness assessment, training principles, and healthy routines, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Fitness logs and skill checklists show measurable improvement related to goal setting, fitness assessment, training principles, and healthy routines.$rst$
WHERE id = 'd9d7b152-fe99-4c15-bab8-c843c07c3c67';

UPDATE courses SET
  title = $rst$Strength Training$rst$,
  short_description = $rst$Builds from fundamentals of safe resistance technique, program design, mobility, and progressive training.$rst$,
  long_description = $rst$The term opens with concrete problems tied to safe resistance technique, program design, mobility, and progressive training, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Fitness logs and skill checklists show measurable improvement related to safe resistance technique, program design, mobility, and progressive training.$rst$
WHERE id = '6ab7e16a-8bd9-4243-8640-6e7bbc20fac8';

UPDATE courses SET
  title = $rst$Painting$rst$,
  short_description = $rst$Core work includes color, surface, composition, materials, and expressive visual language.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to color, surface, composition, materials, and expressive visual language until ideas feel usable. Students annotate their own errors and resubmit selected pieces after feedback.$rst$
WHERE id = '23be5940-8ba4-4ed3-8bad-ac0240c34c69';

UPDATE courses SET
  title = $rst$Basketball Skills$rst$,
  short_description = $rst$Core work includes ball handling, shooting, defense, tactics, and cooperative play.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that ball handling, shooting, defense, tactics, and cooperative play never stays only on a worksheet. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Fitness logs and skill checklists show measurable improvement related to ball handling, shooting, defense, tactics, and cooperative play.$rst$
WHERE id = 'e5774ea4-35d1-4ea0-b55a-94b9b7e95c4c';

UPDATE courses SET
  title = $rst$Jazz Ensemble$rst$,
  short_description = $rst$Study and perform jazz styles including blues, swing, Latin, and Brazilian, with an emphasis on improvisation. Students must play an instrument.$rst$,
  long_description = $rst$Jazz Ensemble will study and perform various jazz stylings, including blues, swing, Latin, Brazilian, and calypso. Each style will be explored historically, theoretically, and in performance. Emphasis will be on the basic concepts of each style as well as improvisation. Students will be exposed to "standards," the classic compositions that are an integral part of any jazz musician's vocabulary. In addition to performing at the upper school arts culmination in December, we will look for other opportunities to perform at open houses and informal lunch concerts and morning meetings. Grading will be based on attendance and participation in class. The Jazz Ensemble is designed to increase a student's musical proficiency, rhythmic vocabulary, ability to improvise, knowledge of theory, and understanding of that uniquely American art form — jazz. NOTE: Any and all outside school performances are mandatory. Prerequisite: Student must play an instrument.$rst$
WHERE id = 'e55b181a-3a75-453c-90d6-0fb3c8e2b1ab';

UPDATE courses SET
  title = $rst$Team Sports$rst$,
  short_description = $rst$Skills and concepts in rules, strategy, communication, sportsmanship, and varied team games.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue rules, strategy, communication, sportsmanship, and varied team games in pairs and on their own. A final project or exam asks students to integrate what they learned about rules, strategy, communication, sportsmanship, and varied team games under modest time pressure.$rst$
WHERE id = 'adfd5124-c389-45df-86aa-c78a2dda866e';

UPDATE courses SET
  title = $rst$Yoga Fitness$rst$,
  short_description = $rst$For students ready to take on posture, mobility, breath, balance, and mindful conditioning.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that posture, mobility, breath, balance, and mindful conditioning never stays only on a worksheet. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about posture, mobility, breath, balance, and mindful conditioning under modest time pressure.$rst$
WHERE id = 'f8d3d9ea-49d9-4ea3-8210-f85064c309c1';

UPDATE courses SET
  title = $rst$Swimming and Water Safety$rst$,
  short_description = $rst$Builds from fundamentals of stroke technique, endurance, rescue awareness, and aquatic confidence.$rst$,
  long_description = $rst$Students track personal goals while practicing stroke technique, endurance, rescue awareness, and aquatic confidence in progressive stations or small-sided games. The teacher conferences mid-term to adjust challenge level without watering down standards. Students leave with personal routines they can continue outside class involving stroke technique, endurance, rescue awareness, and aquatic confidence.$rst$
WHERE id = 'e700941a-b0a9-4773-9edd-3ad000e446aa';

UPDATE courses SET
  title = $rst$Urban Studies$rst$,
  short_description = $rst$Practice with cities, housing, transportation, public space, inequality, and planning.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how cities, housing, transportation, public space, inequality, and planning is used. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about cities, housing, transportation, public space, inequality, and planning under modest time pressure.$rst$
WHERE id = '1fff39d1-fe0f-4481-b48c-a40f196f660d';

UPDATE courses SET
  title = $rst$Dance Fitness$rst$,
  short_description = $rst$Builds from fundamentals of rhythm, coordination, cardiovascular conditioning, and movement sequences.$rst$,
  long_description = $rst$The term opens with concrete problems tied to rhythm, coordination, cardiovascular conditioning, and movement sequences, then widens toward independent work. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. A final project or exam asks students to integrate what they learned about rhythm, coordination, cardiovascular conditioning, and movement sequences under modest time pressure.$rst$
WHERE id = '0ca55ed0-6de7-43bd-8111-1d3fc1cf6a7a';

UPDATE courses SET
  title = $rst$AP Psychology$rst$,
  short_description = $rst$Emphasis on behavior, cognition, development, research methods, and psychological science.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with behavior, cognition, development, research methods, and psychological science as the spine of major assignments. A final project or exam asks students to integrate what they learned about behavior, cognition, development, research methods, and psychological science under modest time pressure.$rst$
WHERE id = '0a8c0681-be5b-4523-90ba-8d58b124573d';

UPDATE courses SET
  title = $rst$AP Human Geography$rst$,
  short_description = $rst$Skills and concepts in spatial patterns, population, culture, cities, and development.$rst$,
  long_description = $rst$Field-adjacent examples keep spatial patterns, population, culture, cities, and development connected to situations students recognize outside school. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint.$rst$
WHERE id = '9f23a6be-2847-477b-9818-55913671c69f';

UPDATE courses SET
  title = $rst$Individual Sports$rst$,
  short_description = $rst$Seminar and studio approaches to self-paced skill development in racquet, target, and lifetime activities.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with self-paced skill development in racquet, target, and lifetime activities, moving between explanation, practice, and critique. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. By the end, students should explain key ideas in self-paced skill development in racquet, target, and lifetime activities clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'bf5bad31-6c66-4ef1-abbb-315b5558d1dd';

UPDATE courses SET
  title = $rst$AP Macroeconomics$rst$,
  short_description = $rst$Lab- and project-driven work on national output, inflation, unemployment, fiscal policy, and monetary policy.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around national output, inflation, unemployment, fiscal policy, and monetary policy. Reading loads stay manageable; the heavier lift is interpreting and producing original work. Students leave with notes and graded work that document progress on national output, inflation, unemployment, fiscal policy, and monetary policy.$rst$
WHERE id = 'f4cfb9f5-2520-4992-896a-3b673bcf5f9d';

UPDATE courses SET
  title = $rst$Economics$rst$,
  short_description = $rst$A practical look at markets, incentives, public policy, personal choice, and economic evidence.$rst$,
  long_description = $rst$What looks like a narrow topic—markets, incentives, public policy, personal choice, and economic evidence—becomes a route into bigger questions about evidence and craft. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '40ab1d96-f63a-4449-b283-5814616c99be';

UPDATE courses SET
  title = $rst$Engineering Capstone$rst$,
  short_description = $rst$Hands-on experience with client-centered design, project management, prototyping, validation, and presentation.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into client-centered design, project management, prototyping, validation, and presentation, others synthesize. Students leave with notes and graded work that document progress on client-centered design, project management, prototyping, validation, and presentation.$rst$
WHERE id = '967ef38f-9541-44db-a5e3-cd6da0ce40f7';

UPDATE courses SET
  title = $rst$Biomedical Engineering$rst$,
  short_description = $rst$Covers human-centered devices, biomechanics, biomaterials, and design ethics.$rst$,
  long_description = $rst$The term opens with concrete problems tied to human-centered devices, biomechanics, biomaterials, and design ethics, then widens toward independent work. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Later courses in the department will assume familiarity with human-centered devices, biomechanics, biomaterials, and design ethics.$rst$
WHERE id = '2c8d60f5-e142-4a22-bf14-39e58e07f000';

UPDATE courses SET
  title = $rst$Global Studies$rst$,
  short_description = $rst$Skills and concepts in interdependence, development, migration, conflict, and international cooperation.$rst$,
  long_description = $rst$Field-adjacent examples keep interdependence, development, migration, conflict, and international cooperation connected to situations students recognize outside school. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Students leave with notes and graded work that document progress on interdependence, development, migration, conflict, and international cooperation.$rst$
WHERE id = '213cbbb6-7f62-46bf-b86e-2e5215ded92e';

UPDATE courses SET
  title = $rst$Cultural Anthropology$rst$,
  short_description = $rst$Seminar and studio approaches to culture, kinship, belief, language, fieldwork, and human diversity.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that culture, kinship, belief, language, fieldwork, and human diversity never stays only on a worksheet. The teacher conferences mid-term to adjust challenge level without watering down standards. Students leave with notes and graded work that document progress on culture, kinship, belief, language, fieldwork, and human diversity.$rst$
WHERE id = '43eba7b9-d383-4485-a454-0acad5677c67';

UPDATE courses SET
  title = $rst$Criminology$rst$,
  short_description = $rst$Core work includes crime theories, justice institutions, evidence, policy, and social context.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue crime theories, justice institutions, evidence, policy, and social context in pairs and on their own. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '14794303-0e1c-45d8-a307-d2f1d986f704';

UPDATE courses SET
  title = $rst$Social Justice Studies$rst$,
  short_description = $rst$Emphasis on inequality, identity, institutions, movements, and community-based inquiry.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with inequality, identity, institutions, movements, and community-based inquiry as the spine of major assignments. Cross-course connections (when schedules allow) show how the same idea travels across disciplines.$rst$
WHERE id = '60a07c8a-a648-4dc0-8fb2-cb149ccf6c3f';

UPDATE courses SET
  title = $rst$Robotics Engineering$rst$,
  short_description = $rst$Mechanical design, electronics, controls, fabrication, and team competition.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with mechanical design, electronics, controls, fabrication, and team competition, moving between explanation, practice, and critique. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about mechanical design, electronics, controls, fabrication, and team competition under modest time pressure.$rst$
WHERE id = 'ad1efd7b-92ef-401f-9442-74604bdee9ac';

UPDATE courses SET
  title = $rst$Mechanical Engineering$rst$,
  short_description = $rst$Emphasis on forces, mechanisms, machine elements, fabrication, and iterative testing.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with forces, mechanisms, machine elements, fabrication, and iterative testing as the spine of major assignments. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'a3dda549-1dce-478e-9bdb-a0c342eb9129';

UPDATE courses SET
  title = $rst$Introduction to Engineering Design$rst$,
  short_description = $rst$Skills and concepts in design process, technical sketching, prototyping, testing, and documentation.$rst$,
  long_description = $rst$Field-adjacent examples keep design process, technical sketching, prototyping, testing, and documentation connected to situations students recognize outside school. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '40c0aff7-3a14-4b41-95f0-57408566bb55';

UPDATE courses SET
  title = $rst$Environmental Engineering$rst$,
  short_description = $rst$Water, waste, air quality, remediation, and sustainable systems.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with water, waste, air quality, remediation, and sustainable systems, moving between explanation, practice, and critique. Group roles rotate so no one is permanently the scribe or the spokesperson. Later courses in the department will assume familiarity with water, waste, air quality, remediation, and sustainable systems.$rst$
WHERE id = 'a9740b4b-fa33-4ee3-9e9d-f802956989d2';

UPDATE courses SET
  title = $rst$Songwriting$rst$,
  short_description = $rst$Performance-centered study of lyrics, melody, harmony, arrangement, demo production, and peer feedback.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to lyrics, melody, harmony, arrangement, demo production, and peer feedback. The teacher conferences mid-term to adjust challenge level without watering down standards. By the end, students should explain key ideas in lyrics, melody, harmony, arrangement, demo production, and peer feedback clearly and apply them without a scripted worksheet.$rst$
WHERE id = '1745de8c-d5cf-4eb2-b438-33234c1d4205';

UPDATE courses SET
  title = $rst$Aerospace Engineering$rst$,
  short_description = $rst$Term work on aerodynamics, propulsion, flight stability, orbital systems, and testing.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to aerodynamics, propulsion, flight stability, orbital systems, and testing. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about aerodynamics, propulsion, flight stability, orbital systems, and testing under modest time pressure.$rst$
WHERE id = '44e22c24-c188-43cc-b634-ee7331b76015';

UPDATE courses SET
  title = $rst$Civil Engineering and Architecture$rst$,
  short_description = $rst$Applied study of structures, sites, materials, drafting, and sustainable built environments.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on structures, sites, materials, drafting, and sustainable built environments. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '47446467-5bbf-4e82-9573-e79e03f60ac1';

UPDATE courses SET
  title = $rst$Principles of Engineering$rst$,
  short_description = $rst$Builds from fundamentals of mechanics, energy, systems, materials, controls, and design analysis.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around mechanics, energy, systems, materials, controls, and design analysis. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about mechanics, energy, systems, materials, controls, and design analysis under modest time pressure.$rst$
WHERE id = '8c74bdf8-813f-488b-b099-f4a93db7d382';

UPDATE courses SET
  title = $rst$Musical Theater$rst$,
  short_description = $rst$Practice with integrated acting, singing, movement, audition skills, and performance.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to integrated acting, singing, movement, audition skills, and performance until ideas feel usable. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Students finish able to describe artistic choices related to integrated acting, singing, movement, audition skills, and performance with specific language.$rst$
WHERE id = '087c241d-868a-4e40-971e-c01f4e99370c';

UPDATE courses SET
  title = $rst$Music Production$rst$,
  short_description = $rst$An elective built around recording, editing, mixing, acoustics, arrangement, and studio workflow.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with recording, editing, mixing, acoustics, arrangement, and studio workflow, moving between explanation, practice, and critique. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. Portfolios and rehearsal notes become the lasting record of progress with recording, editing, mixing, acoustics, arrangement, and studio workflow.$rst$
WHERE id = '68396439-87b5-4873-8e23-79f604e1fdc7';

UPDATE courses SET
  title = $rst$Concert Choir$rst$,
  short_description = $rst$A practical look at ensemble singing, vocal technique, sight-reading, and varied choral repertoire.$rst$,
  long_description = $rst$What looks like a narrow topic—ensemble singing, vocal technique, sight-reading, and varied choral repertoire—becomes a route into bigger questions about evidence and craft. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. By the end, students should explain key ideas in ensemble singing, vocal technique, sight-reading, and varied choral repertoire clearly and apply them without a scripted worksheet.$rst$
WHERE id = '7feb4f92-b291-451f-993c-0008b5a36e08';

UPDATE courses SET
  title = $rst$Directing$rst$,
  short_description = $rst$Emphasis on script interpretation, staging, actor communication, rehearsal planning, and leadership.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to script interpretation, staging, actor communication, rehearsal planning, and leadership. Group roles rotate so no one is permanently the scribe or the spokesperson. By the end, students should explain key ideas in script interpretation, staging, actor communication, rehearsal planning, and leadership clearly and apply them without a scripted worksheet.$rst$
WHERE id = '0398374b-fe06-4c48-a47e-75d0c68a588c';

UPDATE courses SET
  title = $rst$Concert Band$rst$,
  short_description = $rst$A practical look at wind ensemble performance, tone, musicianship, rehearsal, and concert repertoire.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around wind ensemble performance, tone, musicianship, rehearsal, and concert repertoire. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about wind ensemble performance, tone, musicianship, rehearsal, and concert repertoire under modest time pressure.$rst$
WHERE id = '8cfa160e-6489-497d-8a77-100824c10251';

UPDATE courses SET
  title = $rst$Music Theory$rst$,
  short_description = $rst$Hands-on experience with notation, harmony, ear training, analysis, and composition.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into notation, harmony, ear training, analysis, and composition, others synthesize. Portfolios and rehearsal notes become the lasting record of progress with notation, harmony, ear training, analysis, and composition.$rst$
WHERE id = 'a808ae1e-6bde-4549-bcd6-e099cb275f4c';

UPDATE courses SET
  title = $rst$Concert Choir$rst$,
  short_description = $rst$A practical look at ensemble singing, vocal technique, sight-reading, and varied choral repertoire.$rst$,
  long_description = $rst$What looks like a narrow topic—ensemble singing, vocal technique, sight-reading, and varied choral repertoire—becomes a route into bigger questions about evidence and craft. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. By the end, students should explain key ideas in ensemble singing, vocal technique, sight-reading, and varied choral repertoire clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'deb6e88e-4336-40b2-868a-914d5a8dfc94';

UPDATE courses SET
  title = $rst$Concert Choir$rst$,
  short_description = $rst$A practical look at ensemble singing, vocal technique, sight-reading, and varied choral repertoire.$rst$,
  long_description = $rst$What looks like a narrow topic—ensemble singing, vocal technique, sight-reading, and varied choral repertoire—becomes a route into bigger questions about evidence and craft. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. By the end, students should explain key ideas in ensemble singing, vocal technique, sight-reading, and varied choral repertoire clearly and apply them without a scripted worksheet.$rst$
WHERE id = '88be62de-c3e9-40ee-a43d-47daf9c0b947';

UPDATE courses SET
  title = $rst$Accounting I$rst$,
  short_description = $rst$An elective built around financial statements, transactions, ledgers, controls, and business reporting.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to financial statements, transactions, ledgers, controls, and business reporting until ideas feel usable. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Later courses in the department will assume familiarity with financial statements, transactions, ledgers, controls, and business reporting.$rst$
WHERE id = '1844a4c2-563d-46e6-883e-d0776995bc7c';

UPDATE courses SET
  title = $rst$Introduction to Business$rst$,
  short_description = $rst$Builds from fundamentals of business functions, ownership, markets, operations, and workplace decision making.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around business functions, ownership, markets, operations, and workplace decision making. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '52edb6a0-fa94-49ca-93d9-3a51ff07aac9';

UPDATE courses SET
  title = $rst$Technical Theater$rst$,
  short_description = $rst$For students ready to take on scenery, lighting, sound, costumes, safety, and production teamwork.$rst$,
  long_description = $rst$Studio / rehearsal time dominates; reflection journals document decisions related to scenery, lighting, sound, costumes, safety, and production teamwork. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about scenery, lighting, sound, costumes, safety, and production teamwork under modest time pressure.$rst$
WHERE id = 'e2cc0b90-c8e6-4dc3-9cc2-b78a4015bff8';

UPDATE courses SET
  title = $rst$Groove Workshop$rst$,
  short_description = $rst$A music performance workshop on how to form and maintain a band, covering song structure, rehearsal, and performance.$rst$,
  long_description = $rst$Groove Workshop is a music performance workshop designed to teach students how to form and maintain a band — in other words, how to rock! Areas covered will include analysis of song form and structure, rehearsal methods, chart writing, equipment setup, and performance tips and tricks. A big part of being in a successful band is having the ability to communicate and be open to the ideas of others. Making music is a great way to create bonds and build teamwork. This class gives students that opportunity. Goals: master the songs we choose to learn, develop proficiency as musicians through playing challenging music, learn to play well as a band, and perform both at Nueva and in the community. As this is considered an advanced group, students are expected to be proficient at all their individual parts for each song we learn. NOTE: Any and all outside school performances are mandatory. Prerequisites: None, but some musical experience is encouraged.$rst$
WHERE id = '149370ac-14d1-4a12-a0dc-7d370dc22a18';

UPDATE courses SET
  title = $rst$Theater Arts I$rst$,
  short_description = $rst$Core work includes acting foundations, ensemble practice, script analysis, and stage vocabulary.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with acting foundations, ensemble practice, script analysis, and stage vocabulary, moving between explanation, practice, and critique. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about acting foundations, ensemble practice, script analysis, and stage vocabulary under modest time pressure.$rst$
WHERE id = '32179c80-feb8-4b5d-a7a5-694ee470f40d';

UPDATE courses SET
  title = $rst$Theater Production$rst$,
  short_description = $rst$Core work includes full-production rehearsal, design collaboration, stage management, and public performance.$rst$,
  long_description = $rst$Field-adjacent examples keep full-production rehearsal, design collaboration, stage management, and public performance connected to situations students recognize outside school. Support structures include office hours, peer tutors, and optional extension problems for those who want more. By the end, students should explain key ideas in full-production rehearsal, design collaboration, stage management, and public performance clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'd0ecc337-4803-4257-8a4e-f11d8cb067c5';

UPDATE courses SET
  title = $rst$Playwriting$rst$,
  short_description = $rst$Skills and concepts in dramatic structure, dialogue, character, workshop feedback, and revision.$rst$,
  long_description = $rst$Field-adjacent examples keep dramatic structure, dialogue, character, workshop feedback, and revision connected to situations students recognize outside school. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A public or classroom showcase makes student work on dramatic structure, dialogue, character, workshop feedback, and revision visible beyond the studio.$rst$
WHERE id = 'b406bd69-8ccc-4e3f-bef1-84c3fbce4866';

UPDATE courses SET
  title = $rst$Marketing$rst$,
  short_description = $rst$Practice with audience research, positioning, brand strategy, promotion, and campaign measurement.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how audience research, positioning, brand strategy, promotion, and campaign measurement is used. Group roles rotate so no one is permanently the scribe or the spokesperson.$rst$
WHERE id = 'c7bc965b-e1ca-4829-915b-5d45f299d701';

UPDATE courses SET
  title = $rst$Personal Finance$rst$,
  short_description = $rst$A practical look at budgeting, credit, taxes, insurance, investing, and financial decision making.$rst$,
  long_description = $rst$What looks like a narrow topic—budgeting, credit, taxes, insurance, investing, and financial decision making—becomes a route into bigger questions about evidence and craft. By the end, students should explain key ideas in budgeting, credit, taxes, insurance, investing, and financial decision making clearly and apply them without a scripted worksheet.$rst$
WHERE id = '0b60ffef-5ca5-432a-b9e3-1ae9a88ad085';

UPDATE courses SET
  title = $rst$Political Philosophy$rst$,
  short_description = $rst$Hands-on experience with justice, liberty, equality, authority, rights, and civic obligation.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into justice, liberty, equality, authority, rights, and civic obligation, others synthesize. The teacher conferences mid-term to adjust challenge level without watering down standards. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '0827ceb1-51e3-445b-b19a-c99a2645ee03';

UPDATE courses SET
  title = $rst$Philosophy of Mind$rst$,
  short_description = $rst$Skills and concepts in consciousness, identity, perception, artificial intelligence, and personal agency.$rst$,
  long_description = $rst$Field-adjacent examples keep consciousness, identity, perception, artificial intelligence, and personal agency connected to situations students recognize outside school. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Later courses in the department will assume familiarity with consciousness, identity, perception, artificial intelligence, and personal agency.$rst$
WHERE id = '4f8cd2df-7c0e-4aaa-b0f8-6d3b282277ca';

UPDATE courses SET
  title = $rst$Sports and Entertainment Management$rst$,
  short_description = $rst$Core work includes events, sponsorship, budgeting, promotion, operations, and audience experience.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue events, sponsorship, budgeting, promotion, operations, and audience experience in pairs and on their own. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '21db42e2-6aa6-4f10-b78f-f420ccc972c5';

UPDATE courses SET
  title = $rst$Media Literacy$rst$,
  short_description = $rst$Covers source evaluation, representation, algorithms, persuasion, and responsible participation.$rst$,
  long_description = $rst$The term opens with concrete problems tied to source evaluation, representation, algorithms, persuasion, and responsible participation, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '47864a3c-69e9-47f9-b5f0-c7f239effd9f';

UPDATE courses SET
  title = $rst$Podcasting and Audio Storytelling$rst$,
  short_description = $rst$Seminar and studio approaches to reporting, scripting, interviewing, sound design, editing, and distribution.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that reporting, scripting, interviewing, sound design, editing, and distribution never stays only on a worksheet. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. A final project or exam asks students to integrate what they learned about reporting, scripting, interviewing, sound design, editing, and distribution under modest time pressure.$rst$
WHERE id = '522f4896-cf05-4357-8b31-3d0ebf012fe9';

UPDATE courses SET
  title = $rst$Public Forum Debate$rst$,
  short_description = $rst$Skills and concepts in current-events research, concise advocacy, teamwork, and audience adaptation.$rst$,
  long_description = $rst$Field-adjacent examples keep current-events research, concise advocacy, teamwork, and audience adaptation connected to situations students recognize outside school. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Later courses in the department will assume familiarity with current-events research, concise advocacy, teamwork, and audience adaptation.$rst$
WHERE id = '235215dd-7078-4fb3-b0ec-2a4a1f4c84d0';

UPDATE courses SET
  title = $rst$Introduction to Debate$rst$,
  short_description = $rst$Covers claim construction, evidence, refutation, delivery, and tournament formats.$rst$,
  long_description = $rst$The term opens with concrete problems tied to claim construction, evidence, refutation, delivery, and tournament formats, then widens toward independent work. Later courses in the department will assume familiarity with claim construction, evidence, refutation, delivery, and tournament formats.$rst$
WHERE id = 'e09011be-04a4-486e-aac1-844117096c7d';

UPDATE courses SET
  title = $rst$Nutrition and Wellness$rst$,
  short_description = $rst$Seminar and studio approaches to nutrients, food systems, energy balance, habits, and evidence-based choices.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that nutrients, food systems, energy balance, habits, and evidence-based choices never stays only on a worksheet. The teacher conferences mid-term to adjust challenge level without watering down standards. Later courses in the department will assume familiarity with nutrients, food systems, energy balance, habits, and evidence-based choices.$rst$
WHERE id = '18de3a75-496b-47fc-802e-e1774ebaceff';

UPDATE courses SET
  title = $rst$Speech and Debate Team$rst$,
  short_description = $rst$Skills and concepts in competitive speaking events, debate preparation, peer coaching, and tournament reflection.$rst$,
  long_description = $rst$Field-adjacent examples keep competitive speaking events, debate preparation, peer coaching, and tournament reflection connected to situations students recognize outside school. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '386cf578-edaf-40ec-9ff9-cb17b45913be';

UPDATE courses SET
  title = $rst$Public Health$rst$,
  short_description = $rst$For students ready to take on population health, prevention, disparities, epidemiology, and community intervention.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about population health, prevention, disparities, epidemiology, and community intervention. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A final project or exam asks students to integrate what they learned about population health, prevention, disparities, epidemiology, and community intervention under modest time pressure.$rst$
WHERE id = '4b742615-bef6-4da8-9f83-391ce95613e4';

UPDATE courses SET
  title = $rst$Mental Health and Wellbeing$rst$,
  short_description = $rst$Emphasis on stress, resilience, relationships, help-seeking, and stigma reduction.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with stress, resilience, relationships, help-seeking, and stigma reduction as the spine of major assignments. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about stress, resilience, relationships, help-seeking, and stigma reduction under modest time pressure.$rst$
WHERE id = '6d1bcf7d-2e92-4c0e-a15d-82be4e538b84';

UPDATE courses SET
  title = $rst$Steel Drum Band$rst$,
  short_description = $rst$Develop an advanced steel drum ensemble playing complex arrangements across a variety of musical styles.$rst$,
  long_description = $rst$The steel band will explore a variety of music styles, potentially learning compositions by Trinidadian steel drum virtuoso Robert Greenidge. In addition to learning the calypso stylings of Robert's music, we will most likely do several Santana tunes as well as music by Sting and Bill Withers. While the exact composers and compositions may vary by semester, the rhythms of each style present different challenges for each section of the band. The goal of the class is to develop an advanced steel drum ensemble for the high school that will play complex arrangements in a variety of musical styles. The ensemble will perform at school and in the community throughout the year, including the upper school arts culmination in early December. Students will also research the history of the instrument, its cultural significance, its pioneers, and its greatest composers and performers. NOTE: Any and all outside school performances are mandatory.$rst$
WHERE id = '4d062f81-edc7-47c5-8f2c-db92b9ccf8a8';

UPDATE courses SET
  title = $rst$Logic and Critical Thinking$rst$,
  short_description = $rst$Attention to argument structure, validity, fallacies, evidence, and precise reasoning.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to argument structure, validity, fallacies, evidence, and precise reasoning and for revising unfinished work. Reading loads stay manageable; the heavier lift is interpreting and producing original work. By the end, students should explain key ideas in argument structure, validity, fallacies, evidence, and precise reasoning clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'bdbe4561-70b4-4097-8ba1-a0c22e95379a';

UPDATE courses SET
  title = $rst$Psychological Disorders: Body, Mind, and Culture$rst$,
  short_description = $rst$Explore psychiatric disorders through biological, cognitive, social, and cultural lenses. Prereq: Intro to Psychology (or relevant advanced coursework for seniors).$rst$,
  long_description = $rst$In this course we explore what used to be called "abnormal psychology," the study of psychiatric disorders. We look generally at definitions, descriptions, and diagnostic criteria of mental health conditions before digging more deeply into three disorders, which may include anxiety, depression, PTSD, eating disorders, borderline personality disorder, and schizophrenia. To understand each condition, we consider its etiology, symptoms, and treatment through several lenses—biological, cognitive, social, and cultural—adopting a multi-factorial and interactionist approach. We also examine culture-bound conditions such as susto, ghost sickness, resignation syndrome, and hikikomori. The course is inquiry-based, with readings, videos, class discussion, and speakers. Assessments include an individual exploration of a disorder and a group project on treatment, with core texts including Crazy Like Us: The Globalization of the American Psyche and the latest edition of the DSM. Prerequisites: Psychology 101; seniors who have taken advanced biology, anthropology, or online/summer psychology classes may also enroll.$rst$
WHERE id = 'd0362d97-bac6-4521-9ab7-cc726233b8d7';

UPDATE courses SET
  title = $rst$History 9 - World to 1500$rst$,
  short_description = $rst$A full-year survey of major themes in pre-modern world history, from the earliest civilizations to the start of the modern period.$rst$,
  long_description = $rst$This course covers major themes and developments from pre-modern world history. The course starts with a look at the earliest civilizations and ends with an exploration of several cultural conflicts that defined the start of the modern period. Although the course covers a great deal of pre-modern global history, it is not intended as an exhaustive survey of every event or development from this era. Many but not all of the important historical moments from the ancient and medieval periods will be covered.$rst$
WHERE id = '4352b62f-5d1b-4122-a8a8-3727ea908236';

UPDATE courses SET
  title = $rst$Chemical Engineering$rst$,
  short_description = $rst$Apply chemistry, physics, biology, and engineering to real-life problems through mini research projects. Prereq: Chemistry. Coreq: Math 3.$rst$,
  long_description = $rst$Chemical engineers are multi-disciplinarians who apply principles of chemistry, physics, biology, and engineering to solve a range of practical real-life problems, from large-scale production of pharmaceuticals to the development of novel renewable energies or the design of new biomaterials. In this course, some aspects of chemical engineering, such as applications to renewable energies, are investigated with mini research projects including many elements of design thinking such as experimentation on a small scale, process analysis, iteration, and redesign. The general goals are to foster reasoning and analytical skills, mostly in the context of physical and analytical chemistry, through hands-on activities. Students gather qualitative or quantitative data from experimental situations, understand and accurately represent data, and use data to evaluate predictions, support structure determination, and propose plans of action. Projects are supported by mini-lectures to provide a base of content. Prerequisites: Chemistry. Corequisites: Math 3.$rst$
WHERE id = '309fe820-ea8b-489d-9beb-6f28022db74e';

UPDATE courses SET
  title = $rst$Social Emotional Learning 9$rst$,
  short_description = $rst$A 9th-grade social-emotional on-ramp to the Upper School, meeting once per week alternating with DCI 9.$rst$,
  long_description = $rst$The Social-Emotional Learning (SEL) class is a part of Nueva's SEL program, running from preK-12. The SEL program is intended to develop students' capacity for self-reflection, self-regulation, empathy, critical decision-making, and positive social acuity through a skill-based curriculum. Skills we seek to develop include emotional regulation, self-management and awareness, communication, conflict resolution, and goal-setting. In the 9th grade, SEL is intended to be a social-emotional on-ramp to the Upper School experience. We ask students to start building their identity as an Upper Schooler from day one, reflecting on the narratives they have about themselves, and we work on building the ethos of their grade. We tackle common 9th-grade woes: imposter syndrome, perfectionism, and anxieties around success, with a focus on ethical dilemmas and communication skills. By the end of 9th grade, we hope students have a strong sense of themselves, their class ethos, their moral compass, their ability to communicate well, and their next steps. Note: SEL 9 classes meet only once per week, alternating with DCI 9 in the same block.$rst$
WHERE id = '98bce9c8-2b85-4f51-9807-7f8fc6849721';

UPDATE courses SET
  title = $rst$Capitalism & Apocalypse$rst$,
  short_description = $rst$A discussion-based history of capitalism as a system of power, culminating in original student research. Prereq: History 10.$rst$,
  long_description = $rst$Our goal in this class is not to assess some false dichotomy of "capitalism good" or "capitalism bad," but rather to understand how different regimes of capitalism become embedded in our daily lives. The title gestures toward the phrase "it is easier to imagine the end of the world than the end of capitalism." To tell a history of capitalism is to push against the notion of a static present and tell a story of change and contest. Capitalism is conceived as a system of power, one that operates most effectively when that power has become invisible, masked behind a veneer of common-sense understanding. The course examines the cultural processes—deploying languages of race, gender, class, and respectability—by which these systems of power are rendered invisible and visible. The class is discussion-based, with readings in history and theory, and culminates with original student research around moments of transition in American capitalism. Prerequisites: History 10.$rst$
WHERE id = '10d62f5f-fad6-482d-a4ff-8a1a15d615e5';

UPDATE courses SET
  title = $rst$Philosophy of Consciousness and Personhood$rst$,
  short_description = $rst$A reading-and-discussion seminar on consciousness, mind, personhood, and their ethical, medical, and legal implications.$rst$,
  long_description = $rst$This course is a reading-and-discussion seminar centered around the questions: What is consciousness? What makes it difficult to study? Is the mind just the brain? Is consciousness an illusion, and what would that mean? Is our personhood and identity dependent on consciousness? How do these philosophical questions affect ethical, medical, technological, and legal issues? We read works in philosophy, cognitive and neuroscience, and science fiction, such as works by Churchland, Nagel, Chalmers, and Asimov; we discuss ideas such as artificial intelligence, animal testing, split-brain patients, and multiple personality disorder. There will be weekly readings, required discussion points, a mid-semester project, and a final essay.$rst$
WHERE id = 'bccaaf29-8840-4523-a270-2aa6f2df1472';

UPDATE courses SET
  title = $rst$Research in Psychology$rst$,
  short_description = $rst$A follow-up to Intro to Psychology in which students design and run their own quantitative and qualitative studies. Prereq: Intro to Psychology.$rst$,
  long_description = $rst$Can human behavior be quantified? What is the best way to study how and why humans do what they do? In this follow-up to Psychology 101, students continue to examine the biological, cognitive, and sociocultural roots of behavior and mental processes, this time with two new topics: thinking and decision making (with a focus on Daniel Kahneman's two-system theory) and child development (Piaget and Vygotsky, brain development frameworks, and environmental factors that threaten normal development). Unlike in Psych 101, students become the researchers, designing and running two complete studies of their own: one quantitative laboratory experiment and one qualitative study using observation and/or interview methods. They learn to interpret their results and write a journal-style article. The semester ends with students applying their knowledge to a real-world issue. Prerequisites: Intro to Psychology.$rst$
WHERE id = '0466d9fa-3b68-4df3-8b45-a968bf46608c';

UPDATE courses SET
  title = $rst$Complex Analysis$rst$,
  short_description = $rst$An introduction to the theory of analytic functions of one complex variable, a very challenging course. Prereq: Calculus (Linear Algebra or Multivariable Calculus ideal).$rst$,
  long_description = $rst$This is an introduction to the theory of analytic functions of one complex variable. Complex analysis is a fascinating field of study from a purely theoretical point of view, as well as a powerful tool for solving a wide array of applied problems. It is related to many mathematical disciplines, including real analysis, differential equations, algebra, and topology. The numerous applications include wave propagation phenomena in electrodynamics, optics, fluid mechanics, and quantum mechanics; diffusion problems such as heat and contaminant diffusion; engineering tasks such as the computation of buoyancy and resistance; and signal processing and communication theory. This is a very challenging course. Prerequisites: Calculus, and ideally one more elective such as Linear Algebra or Multivariable Calculus.$rst$
WHERE id = '7dea39f2-cf4b-47d2-a324-317784d5afb0';

UPDATE courses SET
  title = $rst$Sound Experience$rst$,
  short_description = $rst$Explore how sound works, from the physics of vibration to digital audio production, field recording, and sound design.$rst$,
  long_description = $rst$In this course, students will explore how sound works—from the physics of vibration and waveforms to the emotional impact of music and auditory storytelling. We will cover a wide range of topics, including psychoacoustics, digital audio production, field recording, and sound design. One primary focus will be studying and creating sounds for video—from sound effects (Foley) to film scores. Students will gain hands-on experience working with a Digital Audio Workstation (DAW), microphones, and recording gear as they learn how to shape sound for different artistic and communicative purposes. The course will culminate in a final project where students create an original audio experience or research-based presentation. Students who play instruments will be encouraged to incorporate their musical abilities into their work.$rst$
WHERE id = '55de8036-cc1a-40d7-8169-7e937da64982';

UPDATE courses SET
  title = $rst$Cinema Studies$rst$,
  short_description = $rst$Study, rather than make, movies—learning the art of understanding and "reading" film through analysis and criticism.$rst$,
  long_description = $rst$Not to be confused with a class where students focus on making movies, this course is about studying movies. With an eye toward cinema appreciation, criticism, and analysis, this class focuses on the art of understanding and "reading" film. We will spend time watching and analyzing portions of nearly 100 films (and some in their entirety). On occasion, there will be an opportunity to experiment with media creation as well, and students will create projects that utilize various cinematic techniques that we discuss together in class. Texts include short weekly readings and chapters from various filmmakers, theorists, critics, and academics, as well as the films that we will engage.$rst$
WHERE id = '1cc64600-a854-4f8e-9191-d45957f9c63e';

UPDATE courses SET
  title = $rst$Intro to Data Analysis$rst$,
  short_description = $rst$Learn basic Python to collect, organize, analyze, and visualize data.$rst$,
  long_description = $rst$You might enjoy this course if you want to learn how to program, you think data is neat, you want to use data to analyze words, numbers and other things, or you want to learn Python to make graphs. Open to all curious folks; any form of problem solving is helpful prior experience. During this class, we will cover how to write basic Python (variables, loops, functions, etc.), how to organize collected data (numbers and words), how to analyze and manipulate data, how to create graphs and other visuals for data, how to structure large amounts of data, how to use Python and Colab to write up a lab or analysis report, and how to begin planning a project on your own.$rst$
WHERE id = '0988d772-ae47-49f7-8d70-8d42179a4993';

UPDATE courses SET
  title = $rst$All About Wearables$rst$,
  short_description = $rst$Design and construct wearable pieces, from decoding sewing patterns to adding simple electronics with Microbits and Lilypad Arduinos.$rst$,
  long_description = $rst$You might enjoy this class if you have ever wanted to customize your clothes, you are curious about electronics but love soft materials, you enjoy sewing, knitting, crocheting, or embroidery, you are curious about how clothing is constructed, you like turning a flat piece of fabric into a 3D object, or you want to experiment with adding simple electronics to wearable designs. A little hand sewing or circuit experience is helpful but not required. During this class, we will learn what different fabrics and materials are made of and why it matters, decode sewing patterns and transform them into wearable pieces, master stitches that hold projects together, and explore Microbits and Lilypad Arduinos and how they bring electronics into fashion.$rst$
WHERE id = '2172e700-efe1-48e2-9828-ddf85bbe4c4c';

UPDATE courses SET
  title = $rst$Monstrosity$rst$,
  short_description = $rst$Consider how society and culture define and redefine the monstrous across genres from gothic to memoir. Prereq: English 9.$rst$,
  long_description = $rst$According to internationally recognized authority on the horror genre and monster theory John Edgar Browning, monsters are "cultural constructions of the terrible that define what it is we subconsciously fear and what it is we are told to hate or love." Definitions of the monster change over time and with each generation. Through a variety of genres from romantic to post-colonial, from gothic to horror, from fairy tales to memoir, we consider how society and culture examine earlier understandings of monstrosity and present-day fascination with the categorization of monsters. Some questions we consider include: how do authors define or redefine the monstrous? Why and how are characters made monstrous, and by whom? To what extent—through image, text, or film—do figures resist that categorization? Prerequisites: English 9.$rst$
WHERE id = 'f89c9c1f-bba3-4de8-9a31-ddd68567350e';

UPDATE courses SET
  title = $rst$Mechanical Engineering$rst$,
  short_description = $rst$Design and build structures and mechanisms that lift heavy loads, using various engineering materials. Prereq: Physics.$rst$,
  long_description = $rst$You might enjoy this class if you want to know how to build structures and mechanisms that can lift huge amounts of weight, you are interested in using engineering materials, or you enjoy designing and building spacecraft or machines like real engineers do. Comfort working in the I-Lab is helpful prior experience. During this class, we will cover understanding of mechanical movements and the theory behind them, designing and building structures or mechanical devices, and how to design and build with various engineering materials. Prerequisites: Physics.$rst$
WHERE id = 'f2310943-df03-4211-b760-3585e7c70c0e';

UPDATE courses SET
  title = $rst$Mobile App Development$rst$,
  short_description = $rst$Learn to build mobile apps with React Native, using device hardware and engaging with app-development ethics.$rst$,
  long_description = $rst$You might enjoy this course if you are curious about the inner workings of mobile apps, you are curious about how phone apps keep people engaged, or you want to make your own cool app. Foundational programming skills are needed to complete assignments. During this class, we will cover how to write code that works for mobile devices, how to pull data from hardware such as location, Bluetooth, rotation, GPS, and cameras, how to organize and structure code for React Native, how to plan and test designed applications on mobile devices, and how to engage with ethics related to app development. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '9ee07fad-383a-4a9d-834a-eff1c8b15050';

UPDATE courses SET
  title = $rst$Women in Literature$rst$,
  short_description = $rst$Study foundational texts by and about women and their long-term influence, culminating in a dramatic adaptation. Prereq: English 9.$rst$,
  long_description = $rst$Women in Literature begins with the careful, in-depth reading of one or more classic literary texts that help us understand the social, historical, creative, and critical contexts of women writers through the ages. The semester then explores how the literary values and long-term legacies of a set of foundational texts and ideas have influenced writing by and about women over the centuries. Students explore the original and ongoing reception of works composed in a variety of genres and across geographic, political, and historical environments. As readers and interlocutors, they co-create a conversation about women's literary history and join contemporary critical debates about representation and self-representation. The semester concludes with students writing and producing a dramatic adaptation of a classic text. The course builds explicitly on skills developed in English 9, 10, and 11. Prerequisites: English 9.$rst$
WHERE id = '1da1e270-9400-4b15-b507-3747740d23f4';

UPDATE courses SET
  title = $rst$Sensory Neuroscience$rst$,
  short_description = $rst$Explore sensory systems down to the molecular level and fundamental concepts in neuroscience. Prereq: Biology.$rst$,
  long_description = $rst$How do we perceive the world around us? Somehow, our brains interpret physical phenomena like light, sound waves, molecules, and temperature to produce our sense of what is happening around us and in our bodies. In this class, we explore sensory systems down to the molecular level, understanding how physical stimuli are translated into a language that our brains can read and generate meaning from. Through this exploration, students learn fundamental concepts in neuroscience, such as how neurons communicate. The unique experiences of people with sensory issues help us consider the holistic nature of our perceptions, while the sensory "superpowers" of other organisms (such as infrared sight and magnetic sense) illuminate how evolution has shaped our sense of the world. Students learn through various sources and modalities, including extracting information from scientific research articles and translating it for specific audiences, and apply their knowledge in a culminating project with options for experimental design, technology design, or science fiction story-writing. Prerequisites: Biology.$rst$
WHERE id = 'd20baf16-d3cc-4f6f-a1b9-3312d786ea54';

UPDATE courses SET
  title = $rst$Linear Algebra$rst$,
  short_description = $rst$Study the properties of matrices with a markedly abstract approach, building communication and analysis skills. Prereq: Math 3.$rst$,
  long_description = $rst$Linear algebra is the branch of mathematics concerning the properties of matrices. It has wide-ranging applications in abstract algebra, functional analysis, and many natural and social sciences, and is particularly malleable to the student's interests, whether theoretical, applied, or computational. Our approach this year is markedly abstract, giving students the opportunity to acquire communication and analysis skills that benefit them in further math classes. These concepts include vectors and vector spaces, linear transformations and matrix representations, determinants, linear dependence and independence, subspaces, bases, and dimensions, orthogonal bases and projections, Gram-Schmidt orthogonalization, Cramer's Rule, linear models and least-squares problems, eigenvectors and eigenvalues, and singular value decomposition. Prerequisites: Math 3.$rst$
WHERE id = '0bf21ec3-6de6-4c9e-9a4e-53c73bbe0cd4';

UPDATE courses SET
  title = $rst$Product Design$rst$,
  short_description = $rst$A yearlong course in physical product and industrial design, from material analysis to polished models and prototypes.$rst$,
  long_description = $rst$You might enjoy this class if you enjoy physical product and industrial design, you want a better understanding of what makes products pleasing, functional, and appreciated, or you want to build design thinking skills toward more complete, polished models and prototypes. Basic familiarity with the shop is helpful, and knowledge of tools like the laser cutter and 3D printers is helpful but not necessary. During this class, we will cover material analysis and choice, shape studies with a focus on abstractions and cultural biases, model building, rapid iteration and sketching techniques, digital design, and sales pitches/presentations.$rst$
WHERE id = 'e66b8ea4-5ea6-4aa8-be72-60489f03153e';

UPDATE courses SET
  title = $rst$Creature Comforts$rst$,
  short_description = $rst$Use design thinking and the I-Lab to design for animal users, learning CNC routing and basic 3D modeling.$rst$,
  long_description = $rst$You might enjoy this class if you like cute animals and want to make them happy, you are interested in the I-Lab and learning more about design thinking, or you want to push yourself to design for a new type of user. No experience is required beyond a basic understanding of the design thinking process. During this class, we will cover how to go through the design process without the ability to interview the user, design thinking, prototyping, and iteration, how to use the CNC router and design for it, and basic 3D modeling (CAD) skills and flatpack design.$rst$
WHERE id = 'd1ff7f9f-fc6c-4f9e-aad8-c536b18552e8';

UPDATE courses SET
  title = $rst$Differential Equations$rst$,
  short_description = $rst$Search for functions satisfying growth properties, combining analytic and computational methods. Prereq: Calculus.$rst$,
  long_description = $rst$This elective introduces students to the search for functions that satisfy a variety of growth properties. Unlike the more familiar algebraic equations, where the unknowns are numbers, here the unknowns are the functions themselves. We explore constructive solution techniques, like the integrating factor, characteristic equations, the Laplace transform, and Fourier series. We proceed to investigate systems of differential equations and their asymptotic properties, in applications ranging from physics, biology, and economics. In this course we combine analytic methods with computational ones, which allow us to simulate, approximate, and visualize complex dynamics. The course culminates with a term project based on the description and analysis of a modeling challenge. Prerequisites: Calculus.$rst$
WHERE id = 'd7627844-5496-45c3-ab32-91c9e3383c0a';

UPDATE courses SET
  title = $rst$Religion and Modernity$rst$,
  short_description = $rst$Use history and the study of religion to explore religion's changing place in public life and private belief. Prereq: History 9.$rst$,
  long_description = $rst$Is religion retreating from public life or becoming more important to people's political views? Are people losing faith, or putting that faith in technology? What do people mean when they say they are "spiritual but not religious"? These questions confront us today and have recurred throughout modern history as developments in science and politics challenge the importance of religion. We approach these questions by turning to history and applying concepts from the study of religion. The class begins with the Protestant Reformation within Christianity and its radical reassessments of private belief and new relationships between church and state. We then study the range of church-state relationships around the world and the new technologies that challenge some beliefs and extend the reach of others. Students read and discuss historical primary documents and contemporary theoretical works in every class, and do writing, classroom teaching, and independent research in a topic of choice. Prerequisites: History 9.$rst$
WHERE id = '36366b5e-cac0-4828-97db-1e06812dd2e1';

UPDATE courses SET
  title = $rst$Mathematical Modeling$rst$,
  short_description = $rst$Develop creative mathematical approaches to model real situations from biology, economics, engineering, and more. Prereq: Calculus.$rst$,
  long_description = $rst$Students are presented with situations from biology, economics, engineering, logistics, management science, politics, and daily life. They develop creative mathematical approaches to build, test, and refine models, focusing on applying the formal mathematics they already know. Modeling problems draw on concepts from logistics and operations research, measurement and regression, game theory and decision theory, algorithmic design, and geometric design and inference. This class is heavily project-based, and students work in teams to produce models and formal write-ups of their approaches and results. Prerequisites: Calculus.$rst$
WHERE id = '9526a7bd-fa52-4824-ad74-de0fba931231';

UPDATE courses SET
  title = $rst$Design Create Innovate (DCI)$rst$,
  short_description = $rst$A required 9th-grade course integrating design thinking, computer science, and engineering, meeting once per week alternating with SEL 9.$rst$,
  long_description = $rst$Design Create Innovate integrates design thinking, computer science, and engineering into a single course that all 9th graders take. This course is designed to build students' creative courage and technical skills, introducing design processes, fabrication techniques, and the importance of documentation. Students master the art of navigating ambiguity as they collaborate to prototype solutions for complex challenges, requiring a commitment to continual iteration and fearless failure. By blending user-centered research—such as empathy interviewing and storyboarding—with computer science methods and systems-level evaluation, the curriculum empowers students to design impactful, technically sound solutions rooted in the needs of others. Note: DCI 9 classes meet only once per week, alternating with SEL 9 in the same block.$rst$
WHERE id = '5de1c7c3-fc25-435a-b25a-eacf4d66ab00';

UPDATE courses SET
  title = $rst$Intro to Mechatronics$rst$,
  short_description = $rst$Build physical projects that sense and interact with the environment, combining electronics, mechanical parts, and Arduino code.$rst$,
  long_description = $rst$You might enjoy this class if you enjoy building physical projects that can sense and interact with the environment (motion, sound, lights, etc.), you are curious about combining electronics, mechanical parts, and coding, or you want significant time to work on a project of your choosing. No prior experience is required, though text-based programming experience helps. During this class, we will cover the "sense-think-act" paradigm, basic electrical circuit theory and electronics skills (breadboards, multimeters, soldering), Arduino microcontrollers, and project planning (breaking down large projects and building proof-of-concept prototypes).$rst$
WHERE id = '0f715098-0289-4c35-aaf0-71d04e2802c9';

UPDATE courses SET
  title = $rst$Biology Research Teams 1$rst$,
  short_description = $rst$A yearlong, hands-on introduction to biology research using model organisms; application required. Prereq: Chemistry and completed course application.$rst$,
  long_description = $rst$There is an application process to be considered for enrollment in Biology Research Teams 1 (BRT 1). In this class, we learn deeply about the scientific process by exploring its history and methods and directly participating in experimental biological research. We learn about the history of the scientific process, current philosophical issues surrounding science, how to approach experimental design and data analysis to mitigate bias and make sound claims, and how to engage with and learn from the scientific literature. Students spend significant periods performing experiments to investigate biological questions using model organisms like bacteria, fruit flies, and roundworms, learning modern laboratory techniques and tools, collecting and analyzing data, and sharing findings in written, visual, and oral formats. This yearlong course prepares students for future research endeavors and is a required course for the student-led advanced course, Biology Research Teams 2. A selection committee assesses potential enrollees based on interest, motivation, and demonstrated skills. Prerequisites: Chemistry and Completed Course Application.$rst$
WHERE id = 'b706f398-986e-44c8-8fd9-6d93ca11cbf5';

UPDATE courses SET
  title = $rst$Adv. Painting$rst$,
  short_description = $rst$Builds on Intro to Painting, continuing work with acrylic and oil across color, light, space, and paint handling.$rst$,
  long_description = $rst$Advanced Painting is a studio class that builds on the Introduction to Painting curriculum and is a continuation in working with paint and exploring a range of applications. The course covers color, light, space and the handling of paint (acrylic and oil) in addition to exploring the beauty of forms and color. Projects in class range from painting people, places and things while simultaneously exploring ideas about abstraction, representation and expression. Students are encouraged to reflect on their own lives, experiences, interests and hobbies as inspiration for their work while building their painting skills. Aside from studio work, there will be critiques, sketchbook homework, some reading, and writing.$rst$
WHERE id = 'b5783b36-3b8e-4389-a444-5ddd98cbb14e';

UPDATE courses SET
  title = $rst$Physics$rst$,
  short_description = $rst$Introduces principles of physical sciences applied to real-world examples, emphasizing Newton's laws. Coreq: Math 2 (or higher).$rst$,
  long_description = $rst$This course aims to improve students' understanding of the world around us, and make their thinking more rigorous, by introducing principles of physical sciences and applying those concepts to real-world examples. We also aim for students to develop a robust set of scientific practices: methods for asking questions, designing and carrying out experiments, interpreting the results, and communicating their results to others. The course emphasizes important principles such as Newton's laws and includes more specific phenomena as necessary to illuminate those principles. Students explore physics experimentally whenever practical; when a phenomenon is not tractable to classroom demonstration, digital simulations are employed. Topics include kinematics, projectile motion, dynamics, Newton's laws, forces, circular motion, energy and its conservation, momentum and its conservation, rotational motion, universal gravitation and Kepler's laws, simple harmonic motion and waves, sound, light and optics, refraction/diffraction/interference, and thermodynamics. Corequisites: Math 2 (or higher).$rst$
WHERE id = 'd40b9b76-94ef-449e-914f-07df242243ed';

UPDATE courses SET
  title = $rst$Dance$rst$,
  short_description = $rst$An energetic, physically active exploration of dance across jazz, ballet, and a class-chosen style, culminating in a performance.$rst$,
  long_description = $rst$This course is an energetic exploration of dance. Divided into three parts over the course of the semester, students will immerse themselves in three different styles of dance: jazz, ballet and a style chosen by the class (tap, hip hop, contemporary, musical theatre, modern, or any other popular requests from students). We will explore the historical background of each style of dance, watch and learn from performances and notable performers and then learn the technique of each style. This elective is physically active and students will be encouraged to explore creativity with movement. Each class will involve a warm up, a focus on dance technique and learning choreography in each style. We will end the semester in a culmination performance of at least one of our dances. Students will receive PE credit for the full year for taking this elective.$rst$
WHERE id = '47355340-cb20-4780-96c9-ce5abefc424d';

UPDATE courses SET
  title = $rst$Intro to Speech and Debate$rst$,
  short_description = $rst$The entry point for Nueva's competitive debate program, covering research, casewriting, and speaking skills.$rst$,
  long_description = $rst$This course is the entry point for Nueva's competitive debate program: extemporaneous speaking, impromptu speaking, parliamentary debate, public forum debate, and world schools debate. Introductory students learn basic research, casewriting, and speaking skills required for novice competition. Experienced students mentor introductory students and work on advanced theory and philosophical positions, strategy, and audience-tailored performance choices. All students compete in at least one interscholastic tournament each semester, though many more are offered. Students with no prior competition experience in at least one target event are highly encouraged to take the elective concurrently with joining the extracurricular team.$rst$
WHERE id = 'e1f35671-ddce-4c36-b3ea-363de7981baf';

UPDATE courses SET
  title = $rst$Intro to Fabrication: Wood$rst$,
  short_description = $rst$Learn woodworking, wood finishing, marquetry, and measurement in an introductory wood fabrication class.$rst$,
  long_description = $rst$You might enjoy this class if you want to make sawdust and learn some new tools, you are interested in woodworking and wood finishing, or you want to learn new problem solving, measuring, and layout skills. No prior experience is required. During this class, we will cover complex inlaid designs using marquetry, layout tools and methods for measuring, and woodworking using saws, routers, and sanders.$rst$
WHERE id = '0dc83b53-86d1-4ca4-b69f-7a87ce002d11';

UPDATE courses SET
  title = $rst$War and Conflict in Literature$rst$,
  short_description = $rst$Explore 20th- and 21st-century texts on war, conflict, power, morality, trauma, and identity. Prereq: English 9.$rst$,
  long_description = $rst$We are told that good stories require conflict—an inflection point of tension—and yet, why do we fight? This course explores 20th- and 21st-century texts focused on the themes of war and conflict, power, morality, trauma, and identity. Specific texts will likely include All Quiet on the Western Front by Erich Maria Remarque and The Things They Carried by Tim O'Brien. Students will likely conduct interviews with veterans to design their own vignettes of the psychological, emotional, moral, and physical implications of war and conflict. Prerequisites: English 9.$rst$
WHERE id = '6cf128b8-cfb0-4415-ad94-24238b4aeacb';

UPDATE courses SET
  title = $rst$Musical Theater$rst$,
  short_description = $rst$Core rehearsal for the spring musical, exploring acting, voice, movement, and characterization, with tech-team options.$rst$,
  long_description = $rst$This elective is open to anyone interested in performing in the spring musical; it is also open to students with a strong interest in the production end of things (e.g., stage managing, tech, etc.). We will begin by workshopping two different scripts and students will vote on which musical we end up producing and performing. While the class serves as core rehearsal time, it also explores key components of acting, including voice work (breathing, articulation, projection, vocal blending, and musicality), stage movement (choreography, blocking, stage picture, and physicality of character) and characterization (focus and concentration, improvisation, open scene work, subtext, motivation, emotional range). Each student also has the opportunity to be a part of a tech team (costumes, props, assistant directing, sound, set design, etc) to help our show come to life. Note: students in this elective will receive 2 units of P.E. credit. NOTE: There will be two after school rehearsals per week for the first part of the semester, moving to three closer to the show, culminating in an immersive tech week and a performance weekend. All performances and technical rehearsals are mandatory.$rst$
WHERE id = 'fa788b80-4ecc-4f9c-a241-5a997d38d51f';

UPDATE courses SET
  title = $rst$Intro Fabrication: Metal$rst$,
  short_description = $rst$Learn MIG welding, metal forming, layout, and measurement in an introductory metal fabrication class.$rst$,
  long_description = $rst$You might enjoy this class if you want to make sparks and learn some new tools, you are interested in welding and metal forming, or you want to learn new problem solving, measuring, and layout skills. No experience is required, though some welding experience is helpful. During this class, we will cover MIG welding steel and preparing your metal, layout tools and methods for measuring, and metal forming using breaks, benders, and heat.$rst$
WHERE id = '897b0fb3-4e93-4310-b659-e954c4c1a726';

UPDATE courses SET
  title = $rst$Data Science$rst$,
  short_description = $rst$Learn to gather, clean, analyze, and visualize data to gain insights and communicate findings.$rst$,
  long_description = $rst$You might enjoy this class if you are not a "CS person" but think it is important to know how to work with data, you are curious about how data can be used to gain insights and influence policy, you like infographics and novel ways of presenting information, or you want more practice programming. Foundational programming skills are needed for some assignments. Topics include ways to get data, cleaning up data, using statistical tools to gain insights, recognizing and avoiding bias in surveys, using R, Ruby, and Tableau, creating novel and aesthetically pleasing data visualizations, and how to answer questions and communicate findings using data. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '9738d315-7cd3-4660-b02d-b4a46d1885e2';

UPDATE courses SET
  title = $rst$Calculus$rst$,
  short_description = $rst$A rigorous year-long course in single-variable calculus interweaving classical, analytic thinking with applications. Prereq: Math 3.$rst$,
  long_description = $rst$Calculus is a rigorous year-long course in single-variable calculus. This course interweaves two approaches: the classical and the applied. First, it immerses students in rigorous, analytic thinking through an emphasis on deductive reasoning and careful proofs of deep results. Students are expected to derive formulas from basic principles and to articulate verbally the connections between mathematical ideas. Second, students encounter a wealth of applications in physics, economics, and other sciences, ranging from fluid dynamics to compound interest, discovering the transformative power of calculus as a problem-solving tool. The curriculum covers limits, epsilon-delta proofs, differentiation rules, applications of differentiation, differential equations, integration and various integration techniques, the fundamental theorem of calculus, transcendental functions, power series, convergence of sequences and series, and various applications. Prerequisites: Math 3.$rst$
WHERE id = 'd1db57e4-9c5c-44d0-a9f7-7979c65b1de0';

UPDATE courses SET
  title = $rst$Finite Mathematics$rst$,
  short_description = $rst$Lab- and project-driven work on linear programming, matrices, Markov chains, and finance.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into linear programming, matrices, Markov chains, and finance, others synthesize. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'fdefe41f-5d04-42e7-bf5c-1718b748ff23';

UPDATE courses SET
  title = $rst$Independent Study: Internship$rst$,
  short_description = $rst$Transcript credit for juniors and seniors engaging in meaningful, experiential learning with an outside organization.$rst$,
  long_description = $rst$The Independent Study: Internship is an opportunity for Nueva juniors and seniors to receive transcript credit for engaging in meaningful, experiential learning with an organization outside of the curricular offerings. Students may elect to take it during the fall or spring semester, or both. The credit must be in place of an elective or during a free period; students may not receive it on top of a full course load. In addition to meeting expectations set by a manager, students should plan on meeting with the internship coordinator and other internship students regularly throughout the semester. Internship requirements include a minimum of 4 hours per week of work (paid or unpaid) and that the position provides learning not possible through existing Nueva curricular offerings. Interested students should contact the internship coordinator before the second and final add/drop period closes.$rst$
WHERE id = 'b9c6ac7b-ef93-4974-a591-4336c77260ea';

UPDATE courses SET
  title = $rst$Biology$rst$,
  short_description = $rst$A full-year 10th-grade course developing understanding of the living world through authentic scientific research. Prereq: Chemistry.$rst$,
  long_description = $rst$Our goal in Biology is to develop students' understanding of and appreciation for the living world in all its complexity. We approach the study of life through several key lenses, including form and function relationships and variations in size and scale. Throughout the year, students perform authentic scientific research and participate in scientific discourse just as any scientist would, developing an understanding of the process of science through direct experience. Students learn to engage with peer-reviewed scientific articles, design sound experiments through iteration, collect and present data, and communicate scientific information to various audiences. Essential questions include: What is life, what capacities does it entail, and what does it require? How do principles from chemistry dictate how biological molecules function? Why is life tied to the need for a heritable and changeable instructional code? How has evolution shaped life on earth? How are the characteristics of an organism shaped by its genetic code and environment? And how do populations and their environments interact, and how is human activity reshaping ecological relationships? Prerequisites: Chemistry.$rst$
WHERE id = '7d1ccecc-fb9f-475f-b5c3-761c518ba0d0';

UPDATE courses SET
  title = $rst$Intro to Film & Video$rst$,
  short_description = $rst$Investigate the moving image as artistic and conceptual exploration through experimental techniques and short projects.$rst$,
  long_description = $rst$This course introduces students to the moving image as a form of artistic and conceptual exploration. Rather than focusing on traditional narrative storytelling, students will investigate how meaning is created through time, rhythm, framing, and editing. Working with digital cameras and editing software, students will learn the technical foundations of video production alongside experimental approaches to image-making. Through a series of short projects, students will explore techniques such as looping, sequencing, duration, and montage, while engaging with both contemporary and historical examples of film and video art. Students will be introduced to artists who use video as a primary medium, considering how moving images can function beyond conventional cinema. Emphasis is placed on creative risk-taking, visual literacy, and the development of an intentional relationship to the camera and editing process.$rst$
WHERE id = '9f3c8b2c-8bc1-4d8a-8d17-b45d59a585db';

UPDATE courses SET
  title = $rst$Chinese Literature & Advanced Research$rst$,
  short_description = $rst$An advanced course in literary analysis and research on the Chinese diaspora, aiming for Intermediate High proficiency. Prereq: Chinese 4.$rst$,
  long_description = $rst$This advanced course is designed for students aiming to dive deeper into literary analysis and advanced research on topics involving the Chinese diaspora. In the fall semester, the course focuses on close readings of selected literature from different historical and literary periods, especially contemporary. Through close reading and discussion, students understand the socio-cultural reality in which the texts were written and their contemporary relevance. In the spring semester, students conduct in-depth research in the target language and present it in various forms, such as an academic paper or panel discussion. Students pursue passion-driven research on topics including history, geopolitical conflict, cultural phenomena, social justice, and environmental citizenship in the Chinese diaspora. The focus is for students to become self-sufficient using Chinese as a research tool in an academic context, aiming for Intermediate High proficiency (ACTFL standards). Prerequisites: Chinese 4 or equivalent.$rst$
WHERE id = 'a138ca41-6ed0-4306-bdd5-6689811ad1f9';

UPDATE courses SET
  title = $rst$English 9$rst$,
  short_description = $rst$A full-year foundational course analyzing literary texts and constructing arguments across genres and historical periods.$rst$,
  long_description = $rst$In English 9, students learn to analyze literary texts and construct arguments as they develop their skills as readers, writers, collaborators, and critical thinkers. We read a variety of texts and genres, including novels, short stories, poetry, plays, and essays, that explore key values, philosophies, and aesthetics of Western culture. The fall semester is devoted to literature of antiquity and its modern echoes, and the spring semester examines literature on the topic of power and creation. Reading texts across a historical spectrum prompts students to consider how texts adopt, adapt, and deviate from recurring types of characters, plot devices, and settings. We ask how these stories imagine what it means to be human, how concepts of good and evil inform our humanity, and how the stories we tell represent various identities and cultures. Over the year, we write analytically and creatively. Texts may include The Odyssey, Frankenstein, Macbeth, and a variety of shorter poems and stories.$rst$
WHERE id = '2c2730a4-e1c9-4cab-8e80-a4aaf8d65ffd';

UPDATE courses SET
  title = $rst$Lincoln-Douglas Debate$rst$,
  short_description = $rst$Lab- and project-driven work on value conflict, philosophical frameworks, evidence, refutation, and competition.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around value conflict, philosophical frameworks, evidence, refutation, and competition. Students leave with notes and graded work that document progress on value conflict, philosophical frameworks, evidence, refutation, and competition.$rst$
WHERE id = '58115363-3198-4528-8f51-50c6fdc0b169';

UPDATE courses SET
  title = $rst$Math 2$rst$,
  short_description = $rst$Builds on Math 1 with further geometry and introductions to exponential/logarithmic functions, polynomials, and modeling. Prereq: Math 1.$rst$,
  long_description = $rst$Math 2 builds on the content and skills developed in Math 1, including further studies in geometry (polygon angles and areas, 3D geometry, circle theorems, general triangle trigonometry, and unit circle trigonometry review) and introductions to exponential and logarithmic functions, higher degree polynomials and factoring, complex numbers, and mathematical modeling. Throughout the course, students work individually and in groups to derive, make sense of, and apply what they are learning to solve compelling problems, while continuing to develop their ability to reflect on and communicate their thinking effectively. Prerequisites: Math 1.$rst$
WHERE id = '9bb61aba-fa2e-4c79-8978-e61c8c27de9a';

UPDATE courses SET
  title = $rst$Gender and Sexuality$rst$,
  short_description = $rst$Study how people navigated gender and sexuality across regions and time periods through primary sources and critical theory.$rst$,
  long_description = $rst$How has masculinity been defined in different regions and time periods? How did people in Ancient Greece and China conceptualize queerness? What is a TERF and how does that relate to the history of feminism? What lies at the intersection of race, class, and gender? This course is for anyone who has ever experienced gender and sexuality—which is to say, everyone. We look at how people navigated individual identity and social expectations around gender and sexuality across a number of case studies: from the ancient Mediterranean to the "Wild West" of the 19th century, to queer and straight life in 1930s New York City, to contemporary conceptualizations of identity and sexuality outside America. Homework and classwork focus on reading and discussing primary sources, historical media, and queer and feminist critical theory. Assessments are primarily short reflective or analytical writing pieces and individual research projects, ending with original research into a case study of the student's choosing.$rst$
WHERE id = '9dc37259-5cb7-4ce3-bbbc-f0fd1ddc1a5c';

UPDATE courses SET
  title = $rst$Algebra II$rst$,
  short_description = $rst$Advanced functions and modeling.$rst$,
  long_description = $rst$A full-year course extending to polynomial, exponential, logarithmic, and rational functions.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000013';

UPDATE courses SET
  title = $rst$Psychology and Memory$rst$,
  short_description = $rst$A psychology elective on reconstructive memory theory and the implications of memory's unreliability. Prereq: Intro to Psychology (or G12 with permission).$rst$,
  long_description = $rst$This psychology elective centers on reconstructive memory theory and explores the implications of memory's inherent unreliability in many contexts. For each aspect of memory we study, we look at the biological, cognitive, social, and cultural factors that contribute to the creation, consolidation, alteration, and loss of memory. We also allow the psychological study of memory to mingle with its portrayal in literature and art. We examine causes and consequences of conditions that affect memory, such as Alzheimer's and trauma/PTSD, and how these are portrayed culturally. We veer into collective memory and the psychological purpose of commemoration, the function of nostalgia, the effects of rumination, and the effects of digital technology on memory. Overall, this is an examination of all things memory, from the biopsychosocial model to literature to cultural anthropology, with diverse project-based assessments. Prerequisites: Intro to Psychology, or grade 12 students with permission of instructor.$rst$
WHERE id = '87d77e0c-f52d-45dc-96b7-219e0cd56928';

UPDATE courses SET
  title = $rst$SEL Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired SEL course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'bfe4238d-5eab-4e4d-9d56-d768c8093473';

UPDATE courses SET
  title = $rst$Semiconductor Processes$rst$,
  short_description = $rst$Explore the processes, metrology, and equipment used to manufacture integrated semiconductors. Prereq: Modern Physics (Fall Semester).$rst$,
  long_description = $rst$How do they make the chips that make your computer work? Students explore the processes, metrology, terminology, concepts, and equipment commonly used in the manufacture of integrated semiconductors. Students explore more deeply into individual process or metrology steps and have the chance to delve into integrated circuit design or special topics of their own choosing. Labs include photolithography and profilometry. Taking advantage of our proximity to Silicon Valley, we include guest speakers from the semiconductor industry and a field trip to a manufacturing facility. Concepts include how to control processes that cannot be seen and the optimization of yield. Prerequisites: Modern Physics (Fall Semester).$rst$
WHERE id = 'e7f2b9e7-0095-42fe-a9d3-88a5b35d76d1';

UPDATE courses SET
  title = $rst$Groove Workshop$rst$,
  short_description = $rst$A music performance workshop on how to form and maintain a band, covering song structure, rehearsal, and performance.$rst$,
  long_description = $rst$Groove Workshop is a music performance workshop designed to teach students how to form and maintain a band — in other words, how to rock! Areas covered will include analysis of song form and structure, rehearsal methods, chart writing, equipment setup, and performance tips and tricks. A big part of being in a successful band is having the ability to communicate and be open to the ideas of others. Making music is a great way to create bonds and build teamwork. This class gives students that opportunity. Goals: master the songs we choose to learn, develop proficiency as musicians through playing challenging music, learn to play well as a band, and perform both at Nueva and in the community. As this is considered an advanced group, students are expected to be proficient at all their individual parts for each song we learn. NOTE: Any and all outside school performances are mandatory. Prerequisites: None, but some musical experience is encouraged.$rst$
WHERE id = 'b4896a44-5e9e-4c19-b2f5-488264aa2c0b';

UPDATE courses SET
  title = $rst$Memoir and Adaptation$rst$,
  short_description = $rst$Focus on creative nonfiction and the memoir genre, investigating truth and craft in life narratives. Prereq: English 9.$rst$,
  long_description = $rst$The particular focus in this course is creative nonfiction, primarily the memoir genre, considering mostly contemporary texts for our investigations of truth and craft in life narratives. Throughout the semester, students reflect upon the complex interplay between memoir texts and the social, historical, geographical, and political forces that shape them, writing several formal analytical responses. Students also craft their own memoirs, informally and in formal assignments. We explore adaptations in various genres as we consider how different forms of storytelling convey elements of truthful memories and experiences. Memoirs studied may include Alison Bechdel's Fun Home, Paul Kalanithi's When Breath Becomes Air, and Alex Haley's Autobiography of Malcolm X. Note: Grade 12 students must opt into this or another English 12 elective. Prerequisites: English 9.$rst$
WHERE id = '122f8240-a3aa-4c5f-951b-0c1586de4e91';

UPDATE courses SET
  title = $rst$SEL Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired SEL course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'bbe81078-f7ea-426d-a999-b7d2e23c3d9c';

UPDATE courses SET
  title = $rst$Chinese 1$rst$,
  short_description = $rst$A yearlong beginning Chinese course focusing on oral communication, pinyin, and simplified characters, aiming for Novice Mid proficiency.$rst$,
  long_description = $rst$The Chinese program provides students opportunities to incorporate communication, collaboration, and technology skills in learning the Chinese language and its rich culture. In Beginning Chinese, students focus on culturally appropriate oral communication in Mandarin while utilizing pinyin to facilitate sound transcription of the tonal language. Reading, writing, and typing in simplified characters (with references to traditional counterparts) progress in parallel with oral skills. Through each thematic unit—starting from self, family, and school and expanding to community and world—students learn vocabulary, language patterns, dialogues, and culture topics, create group presentations, and form conversations for real-life scenarios. Foundational information of geography, history, pronunciation, classroom expressions, and Chinese characters are introduced and reiterated across units. Students aim to achieve Novice Mid proficiency across interpretive, interpersonal, and presentational communications (ACTFL standards).$rst$
WHERE id = '83992916-aa5e-4b1a-bc8b-0eaecb821985';

UPDATE courses SET
  title = $rst$Film and Stage Costume Making$rst$,
  short_description = $rst$Learn how costumes are designed and made for film, TV, cosplay, and stage, including sewing and working with new materials.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in how costumes are designed or made for movies, TV, cosplay, or stage productions, you are interested in learning to sew, or you are interested in working with new costuming and cosplay materials. No prior experience is required. During this class, we will cover costume design, costume layout and fabrication, and working with fabrics, foams, plastics, and other wearable materials.$rst$
WHERE id = '420192a3-c60f-43e1-9377-54b696e59352';

UPDATE courses SET
  title = $rst$Geometries Beyond Euclid$rst$,
  short_description = $rst$Explore diverse forms of geometry through hands-on, student-driven investigations and monthly symposia. Prereq: Math 3.$rst$,
  long_description = $rst$This course exposes students to the diverse forms that the classical study of Geometry has taken over the last two hundred years, through a series of hands-on, student-driven investigations. After a shared introductory unit, students choose three month-long modules to explore independently in small groups. Each module includes readings, both expository and technical, computational and applied challenges, problem solving and writing, and inspiring research prompts. Along the way, students produce artifacts, which they exhibit at monthly Geometry Symposia, culminating in portfolios that they curate under the teacher's mentorship. Modules explore topics ranging across algebraic, combinatorial, differential, hyperbolic, projective, and tropical geometries. Math 3 is a required prerequisite and Calculus is recommended preparation. Prerequisites: Math 3.$rst$
WHERE id = '74905ded-a4f0-468e-bb96-fa2feef68ef3';

UPDATE courses SET
  title = $rst$Immunology$rst$,
  short_description = $rst$Investigate the immune system through a case-study approach, with a heavy focus on primary literature and modeling. Prereq: Biology.$rst$,
  long_description = $rst$Every day, the cells of your immune system target and destroy pathogens. The immune system is highly specialized to resist constant assault, but the tools at its disposal often cause harm to the body itself. Our course investigates the underlying function of the immune system through a case-study approach, analyzing real-life examples of how the immune system can both fight and cause disease. After a whirlwind review of cell biology, students gain a bird's-eye view of the immune system by focusing on how the components of the innate and adaptive immune system interact. We model the stages of innate immune response and investigate how dysregulation can cause Crohn's disease, perform skits to model T-cell activation, and examine the medical records of a bone marrow transplant patient to determine the role of hematopoiesis in robust immune response. With a heavy focus on primary literature and modeling, this class is an opportunity to ask and answer questions about how our own bodies function. Prerequisites: Biology.$rst$
WHERE id = 'f088a6a5-d189-4d27-b933-3e163643a51a';

UPDATE courses SET
  title = $rst$Jazz Ensemble$rst$,
  short_description = $rst$Study and perform jazz styles including blues, swing, Latin, and Brazilian, with an emphasis on improvisation. Students must play an instrument.$rst$,
  long_description = $rst$Jazz Ensemble will study and perform various jazz stylings, including blues, swing, Latin, Brazilian, and calypso. Each style will be explored historically, theoretically, and in performance. Emphasis will be on the basic concepts of each style as well as improvisation. Students will be exposed to "standards," the classic compositions that are an integral part of any jazz musician's vocabulary. In addition to performing at the upper school arts culmination in December, we will look for other opportunities to perform at open houses and informal lunch concerts and morning meetings. Grading will be based on attendance and participation in class. The Jazz Ensemble is designed to increase a student's musical proficiency, rhythmic vocabulary, ability to improvise, knowledge of theory, and understanding of that uniquely American art form — jazz. NOTE: Any and all outside school performances are mandatory. Prerequisite: Student must play an instrument.$rst$
WHERE id = 'cc85a9be-c9c2-496a-9877-28e357cfcf1e';

UPDATE courses SET
  title = $rst$Adv. Topics in Japanese$rst$,
  short_description = $rst$A yearlong topics-based advanced Japanese course aiming for Intermediate High proficiency; a rotating course that may be taken multiple times. Prereq: Japanese 4.$rst$,
  long_description = $rst$Building on Japanese 4 or the equivalent, Advanced Topics in Japanese is a yearlong course that develops students' skills through a topics-based study of grammar, vocabulary, kanji, and culture. Using a communicative approach informed by the five C's of foreign language education (ACTFL), this course enables students to achieve Intermediate High proficiency. Assignments emphasize the interpersonal, interpretive, and presentational modes: students do skits and speeches, read and analyze authentic materials, and discuss advanced topics in Japanese. Topics change yearly and have included geography, robots and technology, food, religion, pop culture, education, history, literature and poetry, performing arts, environmental issues, the atomic bomb, and urban studies. The course uses advanced textbooks and multimedia such as Genki 2, Adventures in Japanese, Tobira, and Quartet. Students can deepen their skills through an optional trip to Japan in the spring. This is a rotating topics course, so it may be taken multiple times for credit. Prerequisites: Japanese 4 or equivalent.$rst$
WHERE id = 'f96f8286-f461-4f78-aaf3-c39b8efba397';

UPDATE courses SET
  title = $rst$Fall Production$rst$,
  short_description = $rst$Rehearse, stage, and present a full-length play, with roles for actors, tech crew, and design teams.$rst$,
  long_description = $rst$Fall Production is open to all students and will offer the opportunity to rehearse, stage, and present a full-length play. Students are encouraged to contribute in ways beyond just acting, and there will be opportunities available during the rehearsal and production process for people of diverse talents and interests, including tech crew and design teams. We will begin by workshopping two different scripts and students will vote on which play we produce and perform. We will then move into academic and dramaturgical work, transitioning to the creative processes of interpretation, blocking, staging, and performance as we ready the play to be presented to the wider community. Rehearsals will be held during class time, with 2-3 after-school sessions per week, culminating in an immersive Tech Week. Any time we have left in the semester after our production will be spent doing theatrical workshops, additional acting scenes, or other opportunities to work on scripts. NOTE: All performances and technical rehearsals, which take place after school, are mandatory.$rst$
WHERE id = 'f3878afe-8af7-47ab-baa7-88844945fdcb';

UPDATE courses SET
  title = $rst$Economic Thesis Seminar$rst$,
  short_description = $rst$A research team making innovations in exciting areas of economic research. Prereq: any economics class and History 10.$rst$,
  long_description = $rst$Economic Thesis Seminar comprises a team of researchers that spends each spring semester making innovations in the most exciting areas of economic research. In prior classes, students have worked with a United Nations commission to investigate blockchain for environmental market failures, designed a new insurance model to reduce the influence of Super PACs, modelled the economic effects of LibGen on academic publishing, and forecasted the effects of a legalized sex work market in California, among many other projects. Most projects utilize mathematical modeling and data analysis, but there is also a need for researchers focused on writing and reading research. Expected workload significantly exceeds the average asked of students in other classes. This course is exclusively open to 11th and 12th graders who have taken at least one prior high school economics class. Prerequisites: Any economics class and History 10.$rst$
WHERE id = 'efc30793-7ec8-4661-b9be-b49f631620cd';

UPDATE courses SET
  title = $rst$Geometry$rst$,
  short_description = $rst$Proof, shape, and measurement.$rst$,
  long_description = $rst$A full-year course on Euclidean geometry, proof, transformations, and trigonometry basics.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000012';

UPDATE courses SET
  title = $rst$Japanese 3$rst$,
  short_description = $rst$Builds on Japanese 2, aiming for Intermediate Low proficiency through grammar, vocabulary, kanji, and culture. Prereq: Japanese 2.$rst$,
  long_description = $rst$Building on Japanese 2 or the equivalent, Japanese 3 is a yearlong course that develops students' reading, writing, speaking, and listening skills in Japanese through a systematic introduction and integration of grammar, vocabulary, kanji, and culture. Using a communicative approach informed by the five C's of foreign language education as defined by ACTFL, this course enables students to achieve Intermediate Low proficiency in Japanese. In assignments and assessments, equal emphasis is given to the three basic modes of communication: the interpersonal, the interpretive, and the presentational. Prerequisites: Japanese 2 or equivalent.$rst$
WHERE id = '1a8cf017-5e35-4c38-b82e-32e0cd9993f5';

UPDATE courses SET
  title = $rst$Existentialism$rst$,
  short_description = $rst$Read existential philosophy and literature on alienation, anxiety, nihilism, absurdity, and the self.$rst$,
  long_description = $rst$What do we talk about when we talk about existentialism, and why do we still talk about it at all? In this course, we read texts in existential philosophy and literature with special emphasis on themes such as alienation, anxiety, nihilism, absurdity, and the self. We examine the works of important existentialist thinkers on the meaning of life, the nature of individuality, freedom, and emotional integrity. The majority of the course focuses on philosophy, beginning with Søren Kierkegaard and Friedrich Nietzsche, then turning to Martin Heidegger, Jean-Paul Sartre, Simone de Beauvoir, and Frantz Fanon. We situate this movement in its historical contexts—two world wars, the Cold War, decolonization—and on matters of race, class, and gender. In the final unit, we trace the influence of existentialist philosophy on literature, film, and popular culture. Students write weekly discussion posts, two short essays, and complete a final research project.$rst$
WHERE id = '030ef74b-8d0f-423e-8606-1f419e7b36eb';

UPDATE courses SET
  title = $rst$Intro to Painting$rst$,
  short_description = $rst$A studio class working with gouache and acrylic to explore color, light, space, and the handling of paint.$rst$,
  long_description = $rst$Intro to Painting is a studio class that teaches students about working with paint and exploring a range of applications. The course covers color, light, space, and the handling of paint (gouache and acrylic) in addition to exploring the beauty of forms and color. Students will be painting people, places, and things while simultaneously exploring ideas about abstraction, representation, and expression. Students are encouraged to reflect on their own lives, experiences, interests, and hobbies as inspiration for their work while building their painting skills. Aside from studio work, there will be critiques, sketchbook homework, some reading, and writing. The ultimate goal is for each student to develop an individual visual vocabulary and to transform an assignment into a quest that demonstrates curiosity, commitment, and craft.$rst$
WHERE id = 'bb5a6965-4d81-4535-a46d-fbe256a1a433';

UPDATE courses SET
  title = $rst$Economics$rst$,
  short_description = $rst$Micro and macro foundations.$rst$,
  long_description = $rst$A single-trimester elective introducing microeconomics, macroeconomics, and markets.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000033';

UPDATE courses SET
  title = $rst$Mathematical Modeling$rst$,
  short_description = $rst$Emphasis on iterative models for scientific, civic, and policy questions.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around iterative models for scientific, civic, and policy questions. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. Students leave with notes and graded work that document progress on iterative models for scientific, civic, and policy questions.$rst$
WHERE id = '93da050f-cb08-4d50-a816-bb96b1b8b816';

UPDATE courses SET
  title = $rst$Sports Performance$rst$,
  short_description = $rst$An elective built around speed, agility, power, recovery, and sport-specific conditioning.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about speed, agility, power, recovery, and sport-specific conditioning. Fitness logs and skill checklists show measurable improvement related to speed, agility, power, recovery, and sport-specific conditioning.$rst$
WHERE id = 'dd0086b0-157d-450a-a9a9-d6d34f59398b';

UPDATE courses SET
  title = $rst$Intro to Machine Learning$rst$,
  short_description = $rst$Learn how machine learning works through classical models and the ethics of model-building. Prereq: at least one non-intro CS elective.$rst$,
  long_description = $rst$You might enjoy this course if you want to know how machine learning works, you like working with data, or you want to see math concepts applied outside of math classes. Helpful prior experience includes comfort thinking conceptually about math and comfort reading and writing code in at least one programming language. During this class, we will cover classical models such as linear regression, classification, and clustering; organizing and preparing data for a model; validating models to make sure they work well; and ethical considerations of models and the decisions we make in creating them. Prerequisites: At least one non-intro computer science elective at Nueva Upper School.$rst$
WHERE id = 'b4990e2e-9c31-4c5f-9815-93f7243e963f';

UPDATE courses SET
  title = $rst$Advanced Topics in Spanish: Cultural Analysis and Lifestyles$rst$,
  short_description = $rst$Explore contemporary issues in the Spanish-speaking world through readings, film, music, and social media. Prereq: Spanish 4.$rst$,
  long_description = $rst$This course explores contemporary issues in the Spanish-speaking world. Through a variety of readings, film viewings, discussions, interviews, music, and social media, we engage more closely with the culture, politics, and social and human landscape of Spanish-speaking communities. Students continue to build vocabulary, idiomatic expressions, and grammatical control with the goal of developing their interpretive, interpersonal, and presentational skills and progressing through ACTFL's Advanced proficiency standards. Students read and analyze texts, give oral and written presentations, and participate in discussions and debates related to the topics of study. A key component is developing relationships with native speakers to gather a variety of perspectives and opinions. Prerequisites: Spanish 4 or equivalent.$rst$
WHERE id = '99a00388-2d5b-421f-8149-55003a3423a1';

UPDATE courses SET
  title = $rst$East Asian History$rst$,
  short_description = $rst$Builds from fundamentals of Chinese, Japanese, and Korean states, cultures, exchanges, and transformations.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around Chinese, Japanese, and Korean states, cultures, exchanges, and transformations. Reading loads stay manageable; the heavier lift is interpreting and producing original work. By the end, students should explain key ideas in Chinese, Japanese, and Korean states, cultures, exchanges, and transformations clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'f143b8ce-2233-452d-a0ed-421d55facf48';

UPDATE courses SET
  title = $rst$United States History$rst$,
  short_description = $rst$Seminar and studio approaches to American political, social, economic, and cultural development.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that American political, social, economic, and cultural development never stays only on a worksheet. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. By the end, students should explain key ideas in American political, social, economic, and cultural development clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'ea6e756f-2b3d-4957-9cd2-c6adf47de378';

UPDATE courses SET
  title = $rst$Oceanography$rst$,
  short_description = $rst$An elective built around ocean circulation, seafloor geology, chemistry, and climate connections.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to ocean circulation, seafloor geology, chemistry, and climate connections until ideas feel usable. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. A lab practical or investigation write-up demonstrates command of ocean circulation, seafloor geology, chemistry, and climate connections.$rst$
WHERE id = 'b25bc1ae-6bc6-435c-8a01-b72ac88f5c73';

UPDATE courses SET
  title = $rst$Cloud Computing$rst$,
  short_description = $rst$A practical look at virtual infrastructure, containers, services, reliability, and deployment.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with virtual infrastructure, containers, services, reliability, and deployment as the spine of major assignments. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about virtual infrastructure, containers, services, reliability, and deployment under modest time pressure.$rst$
WHERE id = '2e99cc69-669d-4ae0-b4fe-d14432c37145';

UPDATE courses SET
  title = $rst$Cybersecurity Fundamentals$rst$,
  short_description = $rst$Term work on threat models, secure systems, cryptography, networks, and ethics.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with threat models, secure systems, cryptography, networks, and ethics as the spine of major assignments. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A working program or project demo anchors the final weeks' focus on threat models, secure systems, cryptography, networks, and ethics.$rst$
WHERE id = '9b4ffa5f-1a80-4686-8308-8d0be94036b7';

UPDATE courses SET
  title = $rst$AP Studio Art: Drawing$rst$,
  short_description = $rst$Hands-on experience with sustained drawing inquiry, experimentation, revision, and portfolio curation.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around sustained drawing inquiry, experimentation, revision, and portfolio curation. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint.$rst$
WHERE id = 'cc80131e-48fb-4d3f-977e-2a439d794cd4';

UPDATE courses SET
  title = $rst$Psychology$rst$,
  short_description = $rst$Core work includes human thought, emotion, behavior, development, and research literacy.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue human thought, emotion, behavior, development, and research literacy in pairs and on their own. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '4753304b-a185-403a-b03a-7b9d954fd055';

UPDATE courses SET
  title = $rst$Sculpture$rst$,
  short_description = $rst$Practice with three-dimensional form, construction, carving, casting, and installation.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with three-dimensional form, construction, carving, casting, and installation, moving between explanation, practice, and critique. Assessments mix short quizzes with performance tasks that look more like real work than trap questions.$rst$
WHERE id = '58075cdc-5240-4a9b-b4cb-6340a326a285';

UPDATE courses SET
  title = $rst$Linguistics: Logic and Language$rst$,
  short_description = $rst$Explore language as a definitively human trait, bridging the humanities and cognitive science through linguistics.$rst$,
  long_description = $rst$From the age-old search for the perfect imaginary language to the dreams of consistency springing from logic, we explore the components of this definitively human trait. Do we think in a language? What constitutes a language anyway? How different is Swahili from Sanskrit or Linear B from Klingon? What language do bilingual children dream in? Are there nonhuman languages? How do computers speak? This course seeks to bridge the "two cultures," with language as the scaffold. On one hand, language is the quintessential human attribute, offering a unique perspective into the human condition; we explore the formal components of linguistics in historical, cultural, and literary contexts. On the other hand, language is a paramount window into the mind and how it arises from the brain, subject to evolutionary forces and now the primary vehicle for experiencing artificial intelligence. Students draw on their own linguistic experiences to explore this indispensable tool for making sense of the world.$rst$
WHERE id = 'c428068f-3949-4d59-b536-db216ed3f47c';

UPDATE courses SET
  title = $rst$Independent Study$rst$,
  short_description = $rst$An application-only opportunity to pursue a deep dive into an academic course of study of the student's choosing.$rst$,
  long_description = $rst$Independent study is an opportunity for students to pursue a deep dive into an academic course of study of their choosing. This research block cannot replace an existing course taught at Nueva. Rather, it is either an extension of a student's interest that may be inspired by a course (e.g., art history, but the student wishes to study Japanese woodblock in particular) or a passion which a student wants to explore in academic detail (e.g., Russian literature). This course is by application only; projects are approved by the Independent Course of Study Coordinator.$rst$
WHERE id = '774d8ed7-780b-457a-bd6a-71a81d1b435b';

UPDATE courses SET
  title = $rst$Materials Engineering$rst$,
  short_description = $rst$Study how engineers design and test advanced materials, covering thermodynamics, heat treatment, and fabrication. Prereq: Physics.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in how engineers design and test heat shields and what happens when they fail, you are interested in more complex materials and how they are designed and fabricated, or you are interested in engineering materials and how they are used in the real world. Helpful prior experience includes intro to physics, basic chemistry, and comfort working in the I-Lab. Topics include engineering thermodynamics, intermediate and advanced material product design, heat treatment metal chemistry, plastics, composites, metals, and other advanced material design and fabrication. Prerequisites: Physics.$rst$
WHERE id = 'bf31c73f-62c0-4d49-9069-cbe168980508';

UPDATE courses SET
  title = $rst$Intro to Clay Sculpture$rst$,
  short_description = $rst$A studio class exploring three-dimensional thinking with clay as the primary medium, for beginners and experienced students alike.$rst$,
  long_description = $rst$Intro to Sculpture is a studio class that explores ways of thinking three-dimensionally, with clay as the primary medium. It serves the needs of beginners and experienced students of art. In addition to sculpture techniques, the elements of the three-dimensional art and design will be studied as they apply to the projects at hand. Students work in both subtractive and additive manners, incorporating basic aesthetic concepts such as line, texture, composition, balance, mass, space, rhythm, tension, movement, light, and density. Students explore the relationship between form and content in materials through hand-building techniques in clay. Projects investigate representation (people and things), abstraction, and architecturally inspired design/installation. Students are encouraged to think about the conceptual possibilities of sculpture and expressing a personal point of view. Students participate in a culminating upper school gallery showing, presentations, and critiques.$rst$
WHERE id = '60f94697-a842-409f-8518-dd153fb28190';

UPDATE courses SET
  title = $rst$The Short Story$rst$,
  short_description = $rst$Compressed narrative, character, point of view, and literary craft.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with compressed narrative, character, point of view, and literary craft, moving between explanation, practice, and critique. Students annotate their own errors and resubmit selected pieces after feedback. By the end, students should explain key ideas in compressed narrative, character, point of view, and literary craft clearly and apply them without a scripted worksheet.$rst$
WHERE id = 'bdace620-2ccd-4f63-a2c9-26a9c27e431b';

UPDATE courses SET
  title = $rst$College Algebra$rst$,
  short_description = $rst$Covers college-paced polynomial, rational, exponential, and logarithmic functions.$rst$,
  long_description = $rst$The term opens with concrete problems tied to college-paced polynomial, rational, exponential, and logarithmic functions, then widens toward independent work. Optional enrichment is posted weekly for students aiming at contests, auditions, or portfolios. By the end, students should explain key ideas in college-paced polynomial, rational, exponential, and logarithmic functions clearly and apply them without a scripted worksheet.$rst$
WHERE id = '867bf181-95a6-4631-b5bf-02e3caa81641';

UPDATE courses SET
  title = $rst$Precalculus$rst$,
  short_description = $rst$Toward the calculus.$rst$,
  long_description = $rst$A full-year course covering advanced trigonometry, sequences, series, and limits.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000014';

UPDATE courses SET
  title = $rst$Studio Art I$rst$,
  short_description = $rst$Foundations of visual art.$rst$,
  long_description = $rst$A single-trimester studio introducing drawing, color, and composition. Offered each trimester.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000052';

UPDATE courses SET
  title = $rst$Sociology$rst$,
  short_description = $rst$Term work on social institutions, culture, inequality, groups, and sociological research.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to social institutions, culture, inequality, groups, and sociological research. Support structures include office hours, peer tutors, and optional extension problems for those who want more.$rst$
WHERE id = '2206e997-b204-4480-ab76-3cf1aa8f8534';

UPDATE courses SET
  title = $rst$AP Microeconomics$rst$,
  short_description = $rst$For students ready to take on consumer choice, firms, market structures, efficiency, and government intervention.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about consumer choice, firms, market structures, efficiency, and government intervention. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Later courses in the department will assume familiarity with consumer choice, firms, market structures, efficiency, and government intervention.$rst$
WHERE id = '6e2f1bee-d6e1-4a30-870b-ee74bb5c14ea';

UPDATE courses SET
  title = $rst$Electrical Engineering$rst$,
  short_description = $rst$Practice with circuits, sensors, signals, measurement, and electronic prototyping.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how circuits, sensors, signals, measurement, and electronic prototyping is used. Group roles rotate so no one is permanently the scribe or the spokesperson. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '5e58b065-9ffe-4d22-8e25-f843b82aaebf';

UPDATE courses SET
  title = $rst$Health Education$rst$,
  short_description = $rst$A practical look at physical, mental, social, and community dimensions of lifelong wellness.$rst$,
  long_description = $rst$What looks like a narrow topic—physical, mental, social, and community dimensions of lifelong wellness—becomes a route into bigger questions about evidence and craft. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Students leave with notes and graded work that document progress on physical, mental, social, and community dimensions of lifelong wellness.$rst$
WHERE id = '9ec7bcd2-15ec-4d77-b7f9-81b75e317d59';

UPDATE courses SET
  title = $rst$AP World History: Modern$rst$,
  short_description = $rst$Global developments, comparison, causation, and document analysis since 1200.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to global developments, comparison, causation, and document analysis since 1200. The teacher conferences mid-term to adjust challenge level without watering down standards. By the end, students should explain key ideas in global developments, comparison, causation, and document analysis since 1200 clearly and apply them without a scripted worksheet.$rst$
WHERE id = '9dd2cd95-9347-45ca-b8cb-05ab1057a0d0';

UPDATE courses SET
  title = $rst$Portfolio Development$rst$,
  short_description = $rst$Seminar and studio approaches to personal artistic direction, advanced revision, documentation, and presentation.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to personal artistic direction, advanced revision, documentation, and presentation until ideas feel usable. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. By the end, students should explain key ideas in personal artistic direction, advanced revision, documentation, and presentation clearly and apply them without a scripted worksheet.$rst$
WHERE id = '30db3987-c272-4d70-aee3-245b3bb154fe';

UPDATE courses SET
  title = $rst$Advanced Problem Solving$rst$,
  short_description = $rst$Practice with olympiad-style reasoning, elegant proofs, and solution critique.$rst$,
  long_description = $rst$Workshops, mini-lectures, and critiques rotate so that olympiad-style reasoning, elegant proofs, and solution critique never stays only on a worksheet. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A final project or exam asks students to integrate what they learned about olympiad-style reasoning, elegant proofs, and solution critique under modest time pressure.$rst$
WHERE id = '591b81e7-8336-4dd9-94bf-0f24ecae9944';

UPDATE courses SET
  title = $rst$Marine Biology$rst$,
  short_description = $rst$Lab- and project-driven work on ocean ecosystems, marine organisms, conservation, and water analysis.$rst$,
  long_description = $rst$The term opens with concrete problems tied to ocean ecosystems, marine organisms, conservation, and water analysis, then widens toward independent work. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A final project or exam asks students to integrate what they learned about ocean ecosystems, marine organisms, conservation, and water analysis under modest time pressure.$rst$
WHERE id = '054ccbd0-3700-454b-9a7a-d607cc422dcf';

UPDATE courses SET
  title = $rst$World History$rst$,
  short_description = $rst$An elective built around global civilizations, exchange, conflict, and change across eras.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to global civilizations, exchange, conflict, and change across eras until ideas feel usable. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about global civilizations, exchange, conflict, and change across eras under modest time pressure.$rst$
WHERE id = '7f077bc3-e89d-40b5-9ecd-6d87ebfb27d7';

UPDATE courses SET
  title = $rst$Materials Science and Engineering$rst$,
  short_description = $rst$Covers material structure, properties, selection, failure, and testing.$rst$,
  long_description = $rst$The term opens with concrete problems tied to material structure, properties, selection, failure, and testing, then widens toward independent work. Later courses in the department will assume familiarity with material structure, properties, selection, failure, and testing.$rst$
WHERE id = 'aba6dc15-87f9-49c1-ae47-cb720a041624';

UPDATE courses SET
  title = $rst$Policy Debate$rst$,
  short_description = $rst$Attention to policy research, case construction, cross-examination, strategy, and competition.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to policy research, case construction, cross-examination, strategy, and competition and for revising unfinished work. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'eae55d07-2c41-44c6-b177-119f4f7e0a47';

UPDATE courses SET
  title = $rst$Japanese I$rst$,
  short_description = $rst$Skills and concepts in foundational Japanese conversation, kana, introductory kanji, and culture.$rst$,
  long_description = $rst$Field-adjacent examples keep foundational Japanese conversation, kana, introductory kanji, and culture connected to situations students recognize outside school. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '88ebdb56-31f9-44dc-ab45-42f61644061d';

UPDATE courses SET
  title = $rst$Technical Theater$rst$,
  short_description = $rst$For students ready to take on scenery, lighting, sound, costumes, safety, and production teamwork.$rst$,
  long_description = $rst$Studio / rehearsal time dominates; reflection journals document decisions related to scenery, lighting, sound, costumes, safety, and production teamwork. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. A final project or exam asks students to integrate what they learned about scenery, lighting, sound, costumes, safety, and production teamwork under modest time pressure.$rst$
WHERE id = '0ed273d0-7697-4e40-b049-2ec7346e2885';

UPDATE courses SET
  title = $rst$Marine Environments$rst$,
  short_description = $rst$A rigorous examination of the interactions between marine and human systems, spanning ecology, chemistry, and geology.$rst$,
  long_description = $rst$Marine Environments is a rigorous examination of the interactions between marine and human systems. The course develops students' understanding of the many disciplines that underlie marine science—ecology, biology, chemistry, geology—and how the ocean interacts with the climate and human society. Some of the topics explored include ocean acidification/warming, biogeochemical cycles, and marine ecology. Students engage in several hands-on activities, and they spend several weeks growing and maintaining algal cultures under different conditions. The overarching goal is for students to develop the scientific literacy and skills necessary to support ocean health and address problems of human impact.$rst$
WHERE id = '72a38686-8e26-43a5-ac16-a0ebe3b9fa5d';

UPDATE courses SET
  title = $rst$Building Toys$rst$,
  short_description = $rst$Build toys out of a variety of materials while studying child development and what makes toys fun, engaging, and safe.$rst$,
  long_description = $rst$You might enjoy this class if you enjoy visiting the lower school, you want to build fun things out of a variety of materials, you are curious about the secrets behind your favorite childhood toys, you think little kids are fascinating, you enjoy making things with your hands, or you notice the tiny details in everyday objects. Having played with toys, done some fabrication, or spent time with young kids are helpful prior experiences. During this class, we will explore how kids of different ages develop as they play, discover toys of the past and what made them fun, engaging, and safe, and put toys to the test to see whether you can make something that kids fall in love with.$rst$
WHERE id = 'ea80e804-4da0-4e05-8204-efe50dfc70f7';

UPDATE courses SET
  title = $rst$Probability and Statistics$rst$,
  short_description = $rst$Applied study of random variables, simulation, distributions, and inference.$rst$,
  long_description = $rst$Graphing tools and written justification are both expected when students present work on random variables, simulation, distributions, and inference. Support structures include office hours, peer tutors, and optional extension problems for those who want more. By the end, students should explain key ideas in random variables, simulation, distributions, and inference clearly and apply them without a scripted worksheet.$rst$
WHERE id = '387fc358-6429-4a36-8c3c-7d6b3aec104c';

UPDATE courses SET
  title = $rst$Intro to Music Production$rst$,
  short_description = $rst$Learn the fundamentals of music production using Ableton Live, from MIDI programming to recording and sound design.$rst$,
  long_description = $rst$Students will learn how to create any type of music that they can dream of, using imagination and the program Ableton Live. Students will learn the fundamental concepts of music production, covering everything from programming electronic compositions using MIDI to recording live instruments and vocals to designing, engineering, and automating their own sounds. Students use musical examples from the industry to understand certain concepts in digital production and learn how to design and produce music using their own sounds and patches. Course assignments include creating musical compositions or designing sounds and patches for future productions using Ableton and are flexible in regard to genre and style (electronic vs. live). The course will model a workshop environment, as we will listen to and discuss student projects as a group. At the end of the course, students produce a final original song at full length.$rst$
WHERE id = 'a02ede5e-a6fd-4cd1-b291-ec7b77521126';

UPDATE courses SET
  title = $rst$History of Mathematics$rst$,
  short_description = $rst$The development of mathematical notation, proof, and major ideas.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to the development of mathematical notation, proof, and major ideas and for revising unfinished work. Reading loads stay manageable; the heavier lift is interpreting and producing original work. By the end, students should explain key ideas in the development of mathematical notation, proof, and major ideas clearly and apply them without a scripted worksheet.$rst$
WHERE id = '7c9c7e1a-3c05-42af-ae46-261c10399737';

UPDATE courses SET
  title = $rst$How to Build Anything?$rst$,
  short_description = $rst$Build more complex and precise objects, learning tolerances, jigs and fixtures, and designing parts that fit and move.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in building things that are more complex or precise, you want to progress as a builder for engineering, art, or general fabrication, or you are interested in how to make multiple items that fit together. Any I-Lab fabrication or building class is helpful prior experience. During this class, we will cover precision measurement, design and fabrication tolerances, designing for assembly and fabrication, designing and building jigs and fixtures, and designing and building things that fit together and move.$rst$
WHERE id = 'c7e8df29-85e5-450f-a8b5-66b7a29b4611';

UPDATE courses SET
  title = $rst$Literature and Film$rst$,
  short_description = $rst$Term work on adaptation, cinematic language, narrative structure, and interpretation.$rst$,
  long_description = $rst$Early assessments check fluency; later ones ask students to combine ideas related to adaptation, cinematic language, narrative structure, and interpretation. Students annotate their own errors and resubmit selected pieces after feedback. By the end, students should explain key ideas in adaptation, cinematic language, narrative structure, and interpretation clearly and apply them without a scripted worksheet.$rst$
WHERE id = '6a8366fd-380f-4994-9cf0-41276d36f8b3';

UPDATE courses SET
  title = $rst$Data Structures and Algorithms$rst$,
  short_description = $rst$Builds from fundamentals of lists, trees, graphs, complexity, searching, and sorting.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into lists, trees, graphs, complexity, searching, and sorting, others synthesize. The teacher conferences mid-term to adjust challenge level without watering down standards. By the end, students should explain key ideas in lists, trees, graphs, complexity, searching, and sorting clearly and apply them without a scripted worksheet.$rst$
WHERE id = '2bfe5603-b550-4696-95f5-12c22d769581';

UPDATE courses SET
  title = $rst$French IV$rst$,
  short_description = $rst$For students ready to take on advanced French expression, literature, film, and cultural inquiry.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about advanced French expression, literature, film, and cultural inquiry. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Later courses in the department will assume familiarity with advanced French expression, literature, film, and cultural inquiry.$rst$
WHERE id = 'fa74b8b2-e5bc-42a6-a3fb-b93c6dba5aa4';

UPDATE courses SET
  title = $rst$Honors Pre-Calculus$rst$,
  short_description = $rst$Skills and concepts in intensive trigonometry, vectors, sequences, and limits.$rst$,
  long_description = $rst$Problem sets reward multiple solution paths, especially when wrestling with intensive trigonometry, vectors, sequences, and limits. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A final project or exam asks students to integrate what they learned about intensive trigonometry, vectors, sequences, and limits under modest time pressure.$rst$
WHERE id = 'eb39c60b-c228-4248-b890-4b39b7b2c241';

UPDATE courses SET
  title = $rst$Combinatorics$rst$,
  short_description = $rst$Emphasis on advanced counting, inclusion-exclusion, and generating functions.$rst$,
  long_description = $rst$The term opens with concrete problems tied to advanced counting, inclusion-exclusion, and generating functions, then widens toward independent work. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '6fda88bd-1f31-4c00-b01d-56a0220f507f';

UPDATE courses SET
  title = $rst$AP Computer Science Principles$rst$,
  short_description = $rst$Applied study of creative computing, data, networks, algorithms, and digital impact.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around creative computing, data, networks, algorithms, and digital impact. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A working program or project demo anchors the final weeks' focus on creative computing, data, networks, algorithms, and digital impact.$rst$
WHERE id = '9952a166-7571-4f52-9744-0d72af13eb05';

UPDATE courses SET
  title = $rst$Intro to Computer Programming$rst$,
  short_description = $rst$A starting point on the CS pathway: learn to write basic Python, structure data, and think like a programmer.$rst$,
  long_description = $rst$You might enjoy this course if you want to learn how to program, you want to dive deep into programming and how to do it well, or you are looking for a place to get started on your CS pathway. Open to all curious folks; any form of problem solving is helpful prior experience. During this class, we will cover how to write basic Python (variables, loops, functions, etc.), how to organize and structure data, how to create games and other interactive visuals, how to think like a programmer, and how to begin planning a project and make it on your own.$rst$
WHERE id = '40391fae-2774-4a5f-9779-d1996ee947bd';

UPDATE courses SET
  title = $rst$Japanese II$rst$,
  short_description = $rst$Builds from fundamentals of developing Japanese communication, kanji, grammar, and cultural fluency.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around developing Japanese communication, kanji, grammar, and cultural fluency. Students annotate their own errors and resubmit selected pieces after feedback. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '6c240970-e518-4517-bb9b-ae3f48f18925';

UPDATE courses SET
  title = $rst$Math 3$rst$,
  short_description = $rst$Spirals deeper into Math 1 and 2 content and prepares students for advanced studies in calculus, statistics, and beyond. Prereq: Math 2.$rst$,
  long_description = $rst$Students spiral deeper into the content developed in Math 1 and Math 2 and prepare for advanced studies in calculus, statistics, number theory, abstract algebra, and other math electives, as well as physics, game theory, economics, and other science/social science electives, through thought-provoking problems and projects. As topics from previous courses are deepened, Math 3 content includes function families and their graphs, trigonometric proofs and identities, complex numbers, parametric equations, polar coordinates, and various topics in geometry, including vectors, circles, and conics, as well as an introduction to topics in calculus. Math 3 serves as a culminating course for Nueva's integrated Math curriculum, helping students see mathematics as a cohesive and beautiful system. Prerequisites: Math 2.$rst$
WHERE id = '8c9c9d72-2f12-40d2-908c-15e821b1110b';

UPDATE courses SET
  title = $rst$Discrete Mathematics$rst$,
  short_description = $rst$Hands-on experience with combinatorics, graph theory, logic, and recurrence.$rst$,
  long_description = $rst$The syllabus is deliberately uneven in pace—some weeks dig deep into combinatorics, graph theory, logic, and recurrence, others synthesize. Group roles rotate so no one is permanently the scribe or the spokesperson. By the end, students should explain key ideas in combinatorics, graph theory, logic, and recurrence clearly and apply them without a scripted worksheet.$rst$
WHERE id = '77d55b3c-ce53-4c5d-9968-9afb64c32502';

UPDATE courses SET
  title = $rst$First Aid and CPR$rst$,
  short_description = $rst$For students ready to take on emergency assessment, injury response, CPR, AED use, and prevention.$rst$,
  long_description = $rst$Discussion norms matter here: peers must press on each other's reasoning about emergency assessment, injury response, CPR, AED use, and prevention. Cross-course connections (when schedules allow) show how the same idea travels across disciplines. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '4af3b798-b6da-4be3-b24d-e2d9694211cc';

UPDATE courses SET
  title = $rst$Digital Storytelling$rst$,
  short_description = $rst$Emphasis on multimodal narrative, audio, image, script, and online publication.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with multimodal narrative, audio, image, script, and online publication as the spine of major assignments. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'b9bda838-f4df-4c4a-9d75-68d7ad0dc22a';

UPDATE courses SET
  title = $rst$Computer Science Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired CS course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'd2457ffb-5f5c-4eee-b206-a7ff7f06b6e5';

UPDATE courses SET
  title = $rst$AP English Literature and Composition$rst$,
  short_description = $rst$Skills and concepts in college-level literary interpretation and timed analytical writing.$rst$,
  long_description = $rst$Field-adjacent examples keep college-level literary interpretation and timed analytical writing connected to situations students recognize outside school. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = 'cd1d6427-d505-43b5-ab4c-b26b3c24faf1';

UPDATE courses SET
  title = $rst$Sound Experience$rst$,
  short_description = $rst$Explore how sound works, from the physics of vibration to digital audio production, field recording, and sound design.$rst$,
  long_description = $rst$In this course, students will explore how sound works—from the physics of vibration and waveforms to the emotional impact of music and auditory storytelling. We will cover a wide range of topics, including psychoacoustics, digital audio production, field recording, and sound design. One primary focus will be studying and creating sounds for video—from sound effects (Foley) to film scores. Students will gain hands-on experience working with a Digital Audio Workstation (DAW), microphones, and recording gear as they learn how to shape sound for different artistic and communicative purposes. The course will culminate in a final project where students create an original audio experience or research-based presentation. Students who play instruments will be encouraged to incorporate their musical abilities into their work.$rst$
WHERE id = 'ff3d70f8-2e16-4b78-954b-149662717578';

UPDATE courses SET
  title = $rst$Women's Literature$rst$,
  short_description = $rst$An elective built around gender, authorship, literary canon, and intersectional perspectives.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to gender, authorship, literary canon, and intersectional perspectives until ideas feel usable. Homework is modest but cumulative; missing a few days is noticeable on the next checkpoint. A final project or exam asks students to integrate what they learned about gender, authorship, literary canon, and intersectional perspectives under modest time pressure.$rst$
WHERE id = '9b90e08a-5106-446e-bc31-3da11d24168d';

UPDATE courses SET
  title = $rst$Ceramics Studio$rst$,
  short_description = $rst$Attention to hand-building, wheel throwing, glazing, firing, and ceramic design.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue hand-building, wheel throwing, glazing, firing, and ceramic design in pairs and on their own. Rubrics privilege clarity of reasoning over mere length; incomplete but thoughtful drafts can still score well. A public or classroom showcase makes student work on hand-building, wheel throwing, glazing, firing, and ceramic design visible beyond the studio.$rst$
WHERE id = '1ec43e89-b2e1-418f-a6ba-48144cfd5776';

UPDATE courses SET
  title = $rst$Ideas in Political Economy$rst$,
  short_description = $rst$An intellectual history of political economy, reading influential thinkers on markets, class, and power from the 18th to 21st century.$rst$,
  long_description = $rst$For as long as economists have studied how the economy works, philosophers and revolutionaries have clashed over how it ought to work. Adam Smith described a new system of markets that could empower common people; Karl Marx condemned that system for shackling workers to machines; and thinkers debate the compatibility of economic growth and environmental sustainability today. In this course we explore those debates in political economy by reading the most influential thinkers on markets, class, and power, from the eighteenth to the twenty-first century. This is a class in intellectual history in which we analyze ideas in their context, and it allows us to assess which theories from the past can help us understand the present. We dive into historically significant texts and spend time with the authors' arguments to understand and evaluate the evidence, assumptions, and convictions that guide them. No background in economics is required.$rst$
WHERE id = '21bf65bd-83ed-4805-85ed-2bb7618998e3';

UPDATE courses SET
  title = $rst$Translation Studies$rst$,
  short_description = $rst$An introduction to translation studies, examining how translation shapes national, cultural, and linguistic identities. Prereq: Chinese 2, Japanese 2, Spanish 2, or equivalent.$rst$,
  long_description = $rst$This course is an introduction to the exciting and interdisciplinary field of translation studies, which examines not only how words and texts are translated but also how they function in the production and transformation of national, cultural, and linguistic identities. The course encourages students to think critically and comparatively about how translation shapes, if not skews, our understanding of other peoples, languages, and cultures. Beginning with the question "What is translation?", this course covers foundational theories and problems of translation before turning to case studies of literature in translation (prose and poetry). The course also examines translation as a metaphor in various films, stories, and other texts. At the end of the course, students produce a translation of their own. Prerequisites: Chinese 2, Japanese 2, Spanish 2, or the equivalent.$rst$
WHERE id = '094911ef-cc58-46aa-896a-622014702f8d';

UPDATE courses SET
  title = $rst$World History$rst$,
  short_description = $rst$Civilizations across time.$rst$,
  long_description = $rst$A full-year survey of world civilizations from antiquity to the modern era.$rst$
WHERE id = '7e574444-0000-4000-a000-000000000031';

UPDATE courses SET
  title = $rst$Science Fiction and Society$rst$,
  short_description = $rst$Attention to speculative worlds, technology, power, and social imagination.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to speculative worlds, technology, power, and social imagination and for revising unfinished work. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Later courses in the department will assume familiarity with speculative worlds, technology, power, and social imagination.$rst$
WHERE id = 'c56a8749-cbb2-41fe-b1a3-03de606e2246';

UPDATE courses SET
  title = $rst$Gothic Literature$rst$,
  short_description = $rst$Suspense, the uncanny, social anxiety, and Gothic conventions.$rst$,
  long_description = $rst$Students spend most of class deeply engaged with suspense, the uncanny, social anxiety, and Gothic conventions, moving between explanation, practice, and critique. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Students leave with notes and graded work that document progress on suspense, the uncanny, social anxiety, and Gothic conventions.$rst$
WHERE id = '0829c161-92ac-4cac-90c7-aff819740e56';

UPDATE courses SET
  title = $rst$Independent Study$rst$,
  short_description = $rst$An application-only opportunity to pursue a deep dive into an academic course of study of the student's choosing.$rst$,
  long_description = $rst$Independent study is an opportunity for students to pursue a deep dive into an academic course of study of their choosing. This research block cannot replace an existing course taught at Nueva. Rather, it is either an extension of a student's interest that may be inspired by a course (e.g., art history, but the student wishes to study Japanese woodblock in particular) or a passion which a student wants to explore in academic detail (e.g., Russian literature). This course is by application only; projects are approved by the Independent Course of Study Coordinator.$rst$
WHERE id = 'ecbcadb1-8ea5-4d72-a8c4-eb6a778e1c0e';

UPDATE courses SET
  title = $rst$Microbiology$rst$,
  short_description = $rst$For students ready to take on microbial diversity, culturing, immunity, disease, and biotechnology.$rst$,
  long_description = $rst$Field-adjacent examples keep microbial diversity, culturing, immunity, disease, and biotechnology connected to situations students recognize outside school. Students annotate their own errors and resubmit selected pieces after feedback. A final project or exam asks students to integrate what they learned about microbial diversity, culturing, immunity, disease, and biotechnology under modest time pressure.$rst$
WHERE id = 'ffd3dae8-4077-458d-ae3c-8ad978971af1';

UPDATE courses SET
  title = $rst$Functional Programming$rst$,
  short_description = $rst$Term work on pure functions, recursion, immutable data, types, and compositional design.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around pure functions, recursion, immutable data, types, and compositional design. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. By the end, students should explain key ideas in pure functions, recursion, immutable data, types, and compositional design clearly and apply them without a scripted worksheet.$rst$
WHERE id = '308dae25-19e9-4583-8aec-f7830aeb99a3';

UPDATE courses SET
  title = $rst$Intro to Computer Programming$rst$,
  short_description = $rst$A starting point on the CS pathway: learn to write basic Python, structure data, and think like a programmer.$rst$,
  long_description = $rst$You might enjoy this course if you want to learn how to program, you want to dive deep into programming and how to do it well, or you are looking for a place to get started on your CS pathway. Open to all curious folks; any form of problem solving is helpful prior experience. During this class, we will cover how to write basic Python (variables, loops, functions, etc.), how to organize and structure data, how to create games and other interactive visuals, how to think like a programmer, and how to begin planning a project and make it on your own.$rst$
WHERE id = '475879da-63fb-4a12-8f88-63f85319ff77';

UPDATE courses SET
  title = $rst$African History$rst$,
  short_description = $rst$Builds from fundamentals of African states, trade networks, colonialism, independence, and contemporary change.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around African states, trade networks, colonialism, independence, and contemporary change. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '2788f7ac-b658-4122-af23-01c87d0a6525';

UPDATE courses SET
  title = $rst$Journalism$rst$,
  short_description = $rst$A yearlong newspaper-production course covering news, feature, opinion, sports, and culture writing plus layout and editorial design.$rst$,
  long_description = $rst$In this yearlong course, students read and write a range of newspaper writing styles, including news, feature, opinion-editorial, sports, and culture. We learn to write for different audiences and purposes, practice revision, and create compelling and meaningful stories that meet standards of accuracy, grammar, style, and journalism ethics. This is a writing and newspaper-production course that explores a variety of storytelling techniques, emphasizes the importance of research and interviewing, and teaches layout and editorial design.$rst$
WHERE id = '8ede570a-9830-4ebb-a6c0-35d13978f337';

UPDATE courses SET
  title = $rst$Asian American Literature$rst$,
  short_description = $rst$Lab- and project-driven work on migration, belonging, family, language, and literary form.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around migration, belonging, family, language, and literary form. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about migration, belonging, family, language, and literary form under modest time pressure.$rst$
WHERE id = '0e0c8747-6382-4ed9-b265-46213c2be65a';

UPDATE courses SET
  title = $rst$Introduction to Philosophy$rst$,
  short_description = $rst$Lab- and project-driven work on fundamental questions, argument analysis, close reading, and philosophical dialogue.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around fundamental questions, argument analysis, close reading, and philosophical dialogue. Later courses in the department will assume familiarity with fundamental questions, argument analysis, close reading, and philosophical dialogue.$rst$
WHERE id = 'd2570fcd-b773-48a2-b6fb-e5555dde194e';

UPDATE courses SET
  title = $rst$Environmental Earth Science$rst$,
  short_description = $rst$Examine how energy and elements shaped Earth and civilization, using the planetary boundaries framework.$rst$,
  long_description = $rst$Environmental Earth Science (EES) examines how energy and elements have shaped the emergence and evolution of Earth, life, and human civilization. Using an interdisciplinary, systems-level lens, the course develops students' understanding of the biological, chemical, and physical processes that drive the Earth system, with a particular focus on energy flows and biogeochemical cycles. With this foundation, students use the planetary boundaries framework to explore how human activities have pushed Earth's systems out of balance—and evaluate how the clean energy transition, regenerative economics, and sustainable food systems can help restore our planet's health and resilience. Coursework includes readings, short activities, quizzes, and individual and group projects. Students also work in the skywalk garden—planting, sampling, and collecting data in and out of class—and participate in at least one field trip.$rst$
WHERE id = '2714d869-0a01-4efd-b467-06a7c3094a46';

UPDATE courses SET
  title = $rst$Intro to CAD$rst$,
  short_description = $rst$Start designing in 3D space using CAD, from 2D sketching to modeling and building movable assemblies.$rst$,
  long_description = $rst$You might enjoy this class if you want to take full advantage of the I-Lab and tools like the 3D printers and laser cutters, you enjoy puzzles and figuring out efficient ways of building objects, or you want to start designing in 3D space. No prior experience is required. During this class, we will cover 2D sketching using dimensions, constraints, and parameters, modeling 3D shapes using basic and advanced tools, construction of assemblies using joints and in-model-building methods, and movable assemblies using joints and motion links.$rst$
WHERE id = '214c6f24-30fb-412d-9519-44fe0d7f76f8';

UPDATE courses SET
  title = $rst$French III$rst$,
  short_description = $rst$An elective built around intermediate French conversation, authentic media, and sustained writing.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to intermediate French conversation, authentic media, and sustained writing until ideas feel usable. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about intermediate French conversation, authentic media, and sustained writing under modest time pressure.$rst$
WHERE id = '86c66ed5-e159-4da3-834d-88e0460a6ce9';

UPDATE courses SET
  title = $rst$Documentary Production$rst$,
  short_description = $rst$Skills and concepts in nonfiction research, ethics, cinematography, editing, and public screening.$rst$,
  long_description = $rst$Field-adjacent examples keep nonfiction research, ethics, cinematography, editing, and public screening connected to situations students recognize outside school. The teacher conferences mid-term to adjust challenge level without watering down standards. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = 'f406e4db-a57f-41d5-abfb-89e48d7bddd3';

UPDATE courses SET
  title = $rst$Adv. Film & Video$rst$,
  short_description = $rst$Builds on Intro to Film & Video, developing an individual artistic voice through sustained time-based projects.$rst$,
  long_description = $rst$This course builds on foundational skills in moving image-making and focuses on the development of an individual artistic voice. Students will work with digital video and editing software to create sustained projects that explore personal, social, or conceptual ideas through time-based media. Expanding on approaches introduced in the introductory course, students will deepen their understanding of duration, sequencing, and structure, while exploring a range of strategies including observational, constructed, and hybrid forms. Emphasis is placed on intentionality, experimentation, and the refinement of ideas through iterative making. Students will engage with contemporary artists working in film and video, situating their work within broader artistic and cultural contexts. Through critique, reflection, and revision, students will develop a cohesive body of work that demonstrates a more advanced ability to shape meaning through image, sound, and time.$rst$
WHERE id = 'b3a5cc8a-ca9c-4aa0-9511-8ec681a89e30';

UPDATE courses SET
  title = $rst$Asian America$rst$,
  short_description = $rst$Examine the complexity and diversity of the Asian American immigration experience and fight for equal recognition.$rst$,
  long_description = $rst$Asian Americans have been in the fabric of America since its beginnings, and yet have been considered perpetual foreigners. Despite the variety of laws targeted at Asian immigration, immigrants have found a way to enter, to settle and build, to become American. This course examines the complexity and diversity of the Asian American immigration experience, the role Asian Americans have played in fighting for equal protection and recognition as Americans, and the modern challenges of being considered perpetual foreigners and a model minority. Because this course is designed for 9th and 10th graders, upperclassmen will be expected to complete a more advanced research project.$rst$
WHERE id = '24261811-0bb4-48f6-aef9-1d818bfb5453';

UPDATE courses SET
  title = $rst$Multivariable Calculus$rst$,
  short_description = $rst$Extend single-variable calculus to functions of several variables, working in two, three, and more dimensions. Prereq: Calculus.$rst$,
  long_description = $rst$Our study of multivariable calculus builds upon techniques learned in single-variable calculus, extending the realm of applications to problems in two, three, and more dimensions. The course provides a venue for students to combine and extend many mathematical techniques from previous courses and apply them to problems of greater complexity. Students generalize their knowledge of differentiation and integration to functions of several variables, learning to work with and visualize two- and three-dimensional functions, vectors, and vector fields. We study techniques for working in n dimensions, including parametric equations, polar coordinates, vectors and vector operations, directional derivatives and gradients, multiple integration, line and surface integrals, Taylor's expansion in n dimensions, and Green's, Stokes', and Gauss' Theorems. Whenever possible, students work with physical or computer models to aid visualization and solve real-world problems, while honing formal mathematics skills through proofs and presentations. Prerequisites: Calculus.$rst$
WHERE id = 'fadb450e-47a5-41a9-985e-e87922944853';

UPDATE courses SET
  title = $rst$English 11$rst$,
  short_description = $rst$A full-year survey of American literature integrated with History 11, asking what stories Americans tell themselves. Prereq: English 10.$rst$,
  long_description = $rst$The particular focus in this course is the rich and varied history of American literature, from precolonial writings to the 21st century. Throughout the year, we examine and reflect on the complex interplay between literature (and other cultural forms) and the historical and political forces that shape it. The course is designed to integrate with History 11 (American History), so students make deep interdisciplinary connections in discussions and essays. The overarching question is "What stories do we tell ourselves as Americans, and why?" Readings of diverse texts encourage students to respond through three key lenses: American identities are shaped by many voices, cultures, and actions often in conflict; American literature is a product of historical dynamics that continue to resonate; and American literary forms reflect the changing notions and needs of a democratic society. Prerequisites: English 10.$rst$
WHERE id = '4e8bca5b-6a05-4145-8f3f-48bc0d54a6c2';

UPDATE courses SET
  title = $rst$19th-Century Adaptations$rst$,
  short_description = $rst$Read 19th-century prose, poetry, and drama that was radical in form, emotion, and gender representation, and trace its modern echoes. Prereq: English 9.$rst$,
  long_description = $rst$First impressions of nineteenth-century literature and culture generally include descriptors such as "prudish," "repressed," "buttoned-up," and "stuffy." But, as this course shows, these texts were also at times deeply radical in their literary forms, emotional expression, gender representation, and social examinations. Through close reading of prose, poetry, drama, and literary criticism, this class considers how these texts and ideas continue to resonate in modern times. Some questions we will consider include: how do these radical texts challenge traditional views of gender, mental health, and spirituality? How do their depictions of love, inheritance, and social boundaries still echo in our cultural imagination? And in what ways can these 19th-century voices still be heard in today's conversations about identity, autonomy, and emotional expression? Prerequisites: English 9.$rst$
WHERE id = '000e84a5-7c7c-4828-974f-09bedce86f40';

UPDATE courses SET
  title = $rst$Interdisciplinary Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'e89baab7-694c-41a2-b445-87f598972549';

UPDATE courses SET
  title = $rst$Creative Writing$rst$,
  short_description = $rst$A foundational creative writing workshop exploring fiction, nonfiction, poetry, playwriting, and hybrid texts.$rst$,
  long_description = $rst$This course serves as a foundational approach to the creative writing workshop, a space where students experiment with and explore their own voice while investigating a multitude of genres (fiction, nonfiction, poetry, playwriting, and hybrid texts). Not only will students have the opportunity to write, read, analyze, and respond to their classmates' writing in a workshop setting; they will study various authors' stylistic choices, literary devices, and literary elements. Students will also learn how to provide constructive feedback to their peers by engaging in class discussions and submitting written comments.$rst$
WHERE id = '57dcd310-0865-4078-b663-50ab7b04a1f4';

UPDATE courses SET
  title = $rst$Political Science$rst$,
  short_description = $rst$Core work includes institutions, power, ideology, participation, and comparative government.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue institutions, power, ideology, participation, and comparative government in pairs and on their own. Group roles rotate so no one is permanently the scribe or the spokesperson. Later courses in the department will assume familiarity with institutions, power, ideology, participation, and comparative government.$rst$
WHERE id = '51f624b5-231a-4b29-999d-9a329ff34511';

UPDATE courses SET
  title = $rst$Computer-Aided Design$rst$,
  short_description = $rst$Practice with parametric modeling, technical drawings, assemblies, and design communication.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how parametric modeling, technical drawings, assemblies, and design communication is used. The last stretch of the term prioritizes revision over packing in brand-new material.$rst$
WHERE id = '419eb21a-a64f-42e6-8712-710533050b88';

UPDATE courses SET
  title = $rst$Economics Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired economics course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'f1efed49-3d03-42f1-9da1-db94ae25eb8d';

UPDATE courses SET
  title = $rst$Ancient Civilizations$rst$,
  short_description = $rst$Emphasis on early societies, belief systems, governance, trade, and archaeology.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with early societies, belief systems, governance, trade, and archaeology as the spine of major assignments. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Students leave with notes and graded work that document progress on early societies, belief systems, governance, trade, and archaeology.$rst$
WHERE id = 'ee33e4fa-898d-46ff-9583-8a8a14a3f73b';

UPDATE courses SET
  title = $rst$Engineering, Fabrication & Design Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired EFD course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '89e5459d-ab48-427c-b32f-fde4742ad03d';

UPDATE courses SET
  title = $rst$Languages Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired language course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'e3a1925d-f9af-4727-99dd-23c57c5af663';

UPDATE courses SET
  title = $rst$Climate Science$rst$,
  short_description = $rst$Hands-on experience with Earth's energy balance, climate records, modeling, and solutions.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on Earth's energy balance, climate records, modeling, and solutions. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. A final project or exam asks students to integrate what they learned about Earth's energy balance, climate records, modeling, and solutions under modest time pressure.$rst$
WHERE id = '57ae4eed-5c39-4cf2-9c36-f12921e71467';

UPDATE courses SET
  title = $rst$Fine Arts Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired arts course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '8fcf52bb-f621-4993-a280-f3c964b33738';

UPDATE courses SET
  title = $rst$Applied Engineering: Biomedical$rst$,
  short_description = $rst$Tackle complex engineering design problems like wearable sensors and surgical robots through open-ended projects. Prereq: Physics.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in more complex engineering design problems, like wearable sensors or surgical robots, you want the freedom to work on open-ended design and fabrication projects, or you are curious about the difference between engineering homework and real-world engineering. Helpful prior experience includes comfort working in the I-Lab, basic electronics and coding with microbit or arduino, and basic CAD and 3D modeling. Topics include engineering project planning, engineering testing and design, intermediate design and fabrication, and intermediate controls and microcontroller programming. Prerequisites: Physics.$rst$
WHERE id = '05cbe81c-c62e-4e9f-8366-5036e234a491';

UPDATE courses SET
  title = $rst$Science Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired science course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'afc99b19-c713-4733-9f7b-c98c2e10d67b';

UPDATE courses SET
  title = $rst$Chinese 5: Current Events & Film$rst$,
  short_description = $rst$Explore contemporary Chinese culture and society through current events and film, aiming for Intermediate High proficiency. Prereq: Chinese 4.$rst$,
  long_description = $rst$The primary focus of Chinese 5 is to further explore topics related to contemporary Chinese culture, economic growth, social challenges, and modernization in order to develop a wider and deeper understanding of Chinese-speaking communities and to bridge the differences between the East and the West. Students continue to lead discussions in Chinese, brainstorming solutions for issues of interest and debating various topics through current events and contemporary films. We focus on current events in the first semester and films in the second semester. This course prepares students to achieve Intermediate High proficiency across interpretive, interpersonal, and presentational communications (ACTFL standards). Prerequisites: Chinese 4 or equivalent.$rst$
WHERE id = 'a7fb2137-3d7c-4795-b2cc-587f60c6d5f2';

UPDATE courses SET
  title = $rst$AP Music Theory$rst$,
  short_description = $rst$For students ready to take on college-level harmony, part writing, aural skills, analysis, and sight-singing.$rst$,
  long_description = $rst$Field-adjacent examples keep college-level harmony, part writing, aural skills, analysis, and sight-singing connected to situations students recognize outside school. The teacher conferences mid-term to adjust challenge level without watering down standards. A final project or exam asks students to integrate what they learned about college-level harmony, part writing, aural skills, analysis, and sight-singing under modest time pressure.$rst$
WHERE id = '7af41a15-ecaa-468b-bf6f-486017ecd3df';

UPDATE courses SET
  title = $rst$Shakespeare Ever After$rst$,
  short_description = $rst$Explore relationships in Shakespeare's plays—romance, jealousy, power, and desire—culminating in a student adaptation. Prereq: English 9.$rst$,
  long_description = $rst$This course explores the messy and passionate terrain of relationships in Shakespeare's plays. From swooning sonnets to emotive jealousy on stage, we analyze how the Bard portrays romantic ideals, sexual politics, heartbreak, and desire. Students investigate the roles of courtship, gender expectations, power, and language in shaping love stories, and dive into Elizabethan theatrical conventions, language, and humor as we explore some of Shakespeare's source material. We investigate critical theory as well, considering performativity and representations of gender and sexuality. As we think about our own adaptation of one of the plays (to be performed at the end of the term), we examine performance history and watch several adaptations for inspiration. Plays may include A Midsummer Night's Dream, Twelfth Night, and Much Ado About Nothing. Prerequisites: English 9.$rst$
WHERE id = '1868edaf-fc9d-4b7c-af98-57f86ee81e45';

UPDATE courses SET
  title = $rst$Intro to Photography$rst$,
  short_description = $rst$A digital studio class on making images and the fundamentals of art and design as they pertain to photography.$rst$,
  long_description = $rst$This studio class will focus on making images and the fundamentals of art and design as they pertain to photography. As a digital class we will work with DSLRs to complete six bodies of work. Students will spend a lot of time making the images and honing skills around composition. In addition to photographic composition, students will learn other technical skills such as camera Raw, Photoshop and digital printing. In addition to making the images, we will build skills around visual literacy, and work on communicating through the images we make. Through readings, slide presentations, and visiting artists, students will consider the context in which they are creating photographs. Students will participate in critiques to develop critical thinking skills and gain a deeper understanding of their work. At the end of the term, students will participate in a school wide art exhibition. This beginning class will be a prerequisite to the Advanced Photography class using the darkroom.$rst$
WHERE id = '06ca9e22-b488-4b64-b717-e19a8234d59d';

UPDATE courses SET
  title = $rst$Physics Research$rst$,
  short_description = $rst$A fall research course exploring topics for the U.S. Invitational Young Physicists Tournament; application required. Prereq: Physics and consent of instructor.$rst$,
  long_description = $rst$There is an application process to be considered for enrollment in Physics Research. This fall-semester course provides an opportunity for students to delve deeply into physics research by exploring topics curated for the U.S. Invitational Young Physicists Tournament. These topics are chosen to be challenging but accessible at the advanced high school level, and usually require a combination of theoretical, numerical/modeling, and experimental investigation. Topics may include phenomena in optics, classical mechanics, fluids, gravitation, and electricity and magnetism. Examples of past tasks include writing code to simulate the trajectory of an object subject to aerodynamic and gravitational forces, building an apparatus to generate and photograph rainbows, or exploring the behavior of pristine and damaged tuning forks. Extensive quantitative data collection and analysis is emphasized. A committee of physics teachers assesses potential enrollees based on interest, motivation, and demonstrated research and problem-solving skills. Prerequisites: Physics and Consent of Instructor.$rst$
WHERE id = '82ee07c4-0ffe-45fd-9bf3-f1f0a20ac98f';

UPDATE courses SET
  title = $rst$Ethics$rst$,
  short_description = $rst$Lab- and project-driven work on moral theories, applied dilemmas, reasoned judgment, and respectful disagreement.$rst$,
  long_description = $rst$Expect a mix of short drills and longer investigations organized around moral theories, applied dilemmas, reasoned judgment, and respectful disagreement. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about moral theories, applied dilemmas, reasoned judgment, and respectful disagreement under modest time pressure.$rst$
WHERE id = 'fd5b8d06-d51e-4a99-81bf-95c22a36fd39';

UPDATE courses SET
  title = $rst$Environmental Humanities$rst$,
  short_description = $rst$Use humanistic questions to address environmental problems, studying storytelling and climate change across disciplines.$rst$,
  long_description = $rst$Environmental Humanities employs humanistic questions about meaning, culture, values, ethics, and responsibilities to address pressing environmental problems, helping to bridge traditional divides between the sciences and the humanities. This interdisciplinary class looks at storytelling and climate change through the study of environmental philosophy, environmental history, ecocriticism, cultural anthropology, and ecosemiotics. Some questions we look at include: whose voice has been centered in the telling of climate change? Whom have we left out of the conversation? How can we tell a convincing story in the face of climate science denial? And what are some new mediums to tell an impactful story in the future? The class contains six modules: Language and Narration, Imperialism and Colonialism, Indigenous Knowledge, Nature, Climate Migration, and the Anthropocene and the Future.$rst$
WHERE id = '4de28c1c-a6f0-4dce-81dd-8f3535aad3d3';

UPDATE courses SET
  title = $rst$Computer Science Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired CS course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '24acf122-c76b-4bc5-bb8f-869033b02232';

UPDATE courses SET
  title = $rst$Programming with OOP$rst$,
  short_description = $rst$Learn object-oriented programming: classes, objects, inheritance, and structuring larger programs.$rst$,
  long_description = $rst$You might enjoy this course if you want to make games or model interactions, you want to be a more efficient programmer, you want to learn how to structure larger and more complex programs, you want to learn more about classes and objects, or you want to understand the organization of the libraries you use. Foundational programming skills are needed to complete assignments. During this class, we will cover classes and objects, inheritance and the organization of connected classes, common strategies for writing well-organized classes, and how to think through and plan out larger projects. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '7e01e2c5-5942-42d4-b087-e9cf836774af';

UPDATE courses SET
  title = $rst$Adv. Photography$rst$,
  short_description = $rst$A second-level studio class exploring creative photographic techniques with a focus on making images.$rst$,
  long_description = $rst$In this second level studio class, we will explore creative techniques in photography with a focus on the act of making images. In most of our classes we will be talking together as a class rather than having the instructor talk at the students. Students will complete several collections of photos or photo essays. In this class, we will examine the decisions involved in taking a picture. You will learn the technical skills (camera, RAW/Lightroom/Photoshop, digital printing) needed to produce "good" photographs. Short readings, slide shows, artist documentaries and class discussions will add theoretical grounding to a series of independent shooting assignments. We will critique assignments as a group and develop a practice of constructive peer review.$rst$
WHERE id = 'd3dd08ed-0665-48b7-832e-503700057dcd';

UPDATE courses SET
  title = $rst$Statistics$rst$,
  short_description = $rst$Learn to interpret data and make statistically significant arguments, exploring study design and inference. Prereq: Math 2.$rst$,
  long_description = $rst$How do we become critical consumers of data? How do we use data effectively to create an argument that is statistically significant? What must we be cautious of when designing an experiment? This course in statistics first explores how to interpret categorical and quantitative data, including both 1- and 2-variate, and then explores different tests that allow us to make inferences and justify conclusions. In the second semester, we explore study design deeply and technically for a degree of association and inference. We also look at sampling techniques as they relate to inference about populations. In addition, we delve into the power of studies before embarking on independent study of inferential statistics within the context of epidemiological and environmental factors. Prerequisites: Math 2.$rst$
WHERE id = '9a72b49f-b273-465a-a336-3393eacdcb8d';

UPDATE courses SET
  title = $rst$String Orchestra$rst$,
  short_description = $rst$Skills and concepts in orchestral strings, ensemble balance, technique, interpretation, and performance.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to orchestral strings, ensemble balance, technique, interpretation, and performance and for revising unfinished work. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. A final project or exam asks students to integrate what they learned about orchestral strings, ensemble balance, technique, interpretation, and performance under modest time pressure.$rst$
WHERE id = 'c17ef994-432b-40ac-a1fe-bf34babaee61';

UPDATE courses SET
  title = $rst$Algorithms$rst$,
  short_description = $rst$An introduction to theoretical computer science: proofs, asymptotic analysis, data structures, and algorithm design.$rst$,
  long_description = $rst$You might enjoy this class if you think you might want to study computer science in college, you want to know whether "computer science" and "programming" are the same thing (they're not), you are interested in areas of computer science that do not involve programming, or you like puzzles, math, and the feeling of things making sense. Helpful prior experience includes foundational programming skills; concepts from Math 2 (limits and logarithms) are helpful but not required. Topics include proofs (ensuring code is correct and terminates), asymptotic analysis, PageRank and SEO, data structures beyond arrays/lists/objects, stable matching, techniques for designing and analyzing algorithms (finite state machines, dynamic programming, relaxation), and advanced topics in theoretical computer science. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '7aee3f62-369d-4d95-a58e-49dd286dd254';

UPDATE courses SET
  title = $rst$Computer Security$rst$,
  short_description = $rst$Explore threats against online systems and how to protect against them, from cryptography to authentication and forensics.$rst$,
  long_description = $rst$You might enjoy this class if you are curious about the various types of threats against online systems and how to protect against them, and you enjoy having freedom to choose your own projects and topics of exploration responsibly. No prior experience with computer security is required; foundational programming skills will be needed to complete some assignments. Topics include the legality and ethics of computer security and hacking, defending against injection attacks with user input validation, cryptography, authentication, authorization, and forensics. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '8880b3e9-cf54-4e2e-a6c7-a6f340ca4a92';

UPDATE courses SET
  title = $rst$Economic Inequality$rst$,
  short_description = $rst$Use macroeconomic models and statistical tools to understand and forecast the effects of economic inequality around the globe.$rst$,
  long_description = $rst$Economic Inequality is the driving force behind many of the most significant political upheavals of the 21st century. This one-semester course leverages macroeconomic models and statistical tools to understand and forecast the effects of economic inequality around the globe. Students begin by teaching each other about the mechanics and importance of major indexes to measure economic inequality, then read and critique Piketty's Capital in the 21st Century. The class dives into texts, pilot programs, and proposals concerning universal basic income, culminating in academic debates. The analysis examines the economic underpinnings of racial inequality in America through mass incarceration and federal housing policy, and students conclude by interviewing stakeholders about affordable housing development. There are no required prerequisites; students who have taken macroeconomics will find this a relevant application of those tools.$rst$
WHERE id = '6cf40d66-839c-40a0-9c77-673a73227454';

UPDATE courses SET
  title = $rst$What Is Philosophy?$rst$,
  short_description = $rst$A broad survey of philosophy covering metaphysics, epistemology, ethics, aesthetics, and social and political philosophy.$rst$,
  long_description = $rst$Why does anything exist? Why can't we turn around in time as we can in space? Is time even real? What is a society, and how should it be organized? Is justice something other than the interests of the powerful? Is democracy better than other political systems? In this course we consider how philosophers in a variety of contexts, from the ancient world to the present, have thought about such questions. You will have the chance to think, talk, and write about these matters and other problems of interest to you. This course is intended to be a broad survey of philosophy and covers topics in metaphysics, epistemology, ethics, aesthetics, and social and political philosophy.$rst$
WHERE id = '03f40ffa-11e4-4e36-8941-82f29fd346d6';

UPDATE courses SET
  title = $rst$Languages Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired language course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '259d649f-045e-4b8e-bb46-dcab37d73531';

UPDATE courses SET
  title = $rst$Creative Writing$rst$,
  short_description = $rst$A foundational creative writing workshop exploring fiction, nonfiction, poetry, playwriting, and hybrid texts.$rst$,
  long_description = $rst$This course serves as a foundational approach to the creative writing workshop, a space where students experiment with and explore their own voice while investigating a multitude of genres (fiction, nonfiction, poetry, playwriting, and hybrid texts). Not only will students have the opportunity to write, read, analyze, and respond to their classmates' writing in a workshop setting; they will study various authors' stylistic choices, literary devices, and literary elements. Students will also learn how to provide constructive feedback to their peers by engaging in class discussions and submitting written comments.$rst$
WHERE id = '4a36a019-aa8b-4e44-bc8c-8b8bc0435bf7';

UPDATE courses SET
  title = $rst$Women's History$rst$,
  short_description = $rst$Reading, writing, and analysis focused on women's work, activism, family life, citizenship, and historical agency.$rst$,
  long_description = $rst$Guest voices (recordings, articles, or local practitioners) periodically reframe how women's work, activism, family life, citizenship, and historical agency is used. Assessments mix short quizzes with performance tasks that look more like real work than trap questions. Credit depends on both the summative assessment and consistent participation during class meetings.$rst$
WHERE id = '7e2c42e0-dfbc-43d3-ae19-2c6561267f30';

UPDATE courses SET
  title = $rst$Jazz Ensemble$rst$,
  short_description = $rst$Term work on improvisation, swing, ensemble style, transcription, and performance.$rst$,
  long_description = $rst$Materials range from classic sources to current tools, all oriented around improvisation, swing, ensemble style, transcription, and performance. Support structures include office hours, peer tutors, and optional extension problems for those who want more. Students finish able to describe artistic choices related to improvisation, swing, ensemble style, transcription, and performance with specific language.$rst$
WHERE id = '13c0739a-3800-4dec-8c51-5a7b03bd9618';

UPDATE courses SET
  title = $rst$Models of Group Decisions$rst$,
  short_description = $rst$Explore political economy and modeling paradigms—game theory, auctions, voting—that shape collective decisions. Prereq: Intro to Microeconomics and Math 2.$rst$,
  long_description = $rst$In this elective we read widely to familiarize ourselves with elements of political economy and the role of institutional arrangements for aggregating preferences in a historical and global context. We explore modeling paradigms, from game theory and auctions to voting schemes, in an attempt to disentangle the non-market forces that shape the economy. Limits to rationality and a host of behavioral norms and biases challenge us to develop rich enough models to accommodate them. This course probes the interface between social science and mathematics, both in substance and in modes of inquiry, involving readings and debate as well as computer modeling of interacting economic agents. Prerequisites: Intro to Microeconomics and Math 2.$rst$
WHERE id = 'a6d67294-c1af-44b6-b652-7a246b0fb5d5';

UPDATE courses SET
  title = $rst$Adv. Clay Sculpture$rst$,
  short_description = $rst$Builds on Intro to Clay Sculpture, continuing to explore three-dimensional thinking with a range of clay bodies.$rst$,
  long_description = $rst$Advanced Sculpture is a studio class that builds on the foundations of the Introduction to Sculpture class. Students continue to explore making sculpture with a range of clay bodies as the primary medium and ways of thinking three-dimensionally. This class serves the needs of beginners and experienced students for art. In addition to sculpture techniques, the elements of the three-dimensional art and design will be studied as they apply to the projects at hand. Students work in both subtractive and additive manners, incorporating basic aesthetic concepts such as line, texture, composition, balance, form, mass, space, rhythm, tension, movement, light, and density. Students explore the relationship between form and content in materials through hand building techniques in clay. Projects investigate representation (people and things), abstraction, and architecturally inspired design/installation. Students are encouraged to think about the conceptual possibilities of sculpture and expressing a personal point of view.$rst$
WHERE id = 'e88d0285-b691-48be-afb4-602d533461e6';

UPDATE courses SET
  title = $rst$Japanese 1$rst$,
  short_description = $rst$A yearlong introductory Japanese course developing reading, writing, speaking, and listening, aiming for Novice Mid proficiency.$rst$,
  long_description = $rst$Japanese 1 is a year-long introductory course that develops students' reading, writing, speaking, and listening skills through a systematic introduction and integration of grammar, vocabulary, kanji, and culture. Using a communicative approach informed by the five C's of foreign language education as defined by ACTFL (Communication, Cultures, Connections, Comparisons, and Communities), this course enables students to achieve Novice Mid proficiency in Japanese. In assignments and assessments, equal emphasis is given to the three basic modes of communication: the interpersonal, the interpretive, and the presentational.$rst$
WHERE id = '0c38129f-254a-48be-a2ae-a850189e4b4e';

UPDATE courses SET
  title = $rst$Engineering, Fabrication & Design Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired EFD course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'b2f3a0a3-635f-4829-8987-24cc557384c8';

UPDATE courses SET
  title = $rst$Environmental Economics$rst$,
  short_description = $rst$A focused study of environmental economics through academic papers, microeconomic models, and the Electricity Strategy Game.$rst$,
  long_description = $rst$Environmental economics is possibly the most consequential field of the entire discipline, while simultaneously being the subject which traditional economics fails most comprehensively to understand. This focused semester-long course attempts to answer some of the most complex questions facing economists today: How should we quantitatively value the lives of future generations? How do we know the true worth of an environmental good never traded on a market? Can we design an international climate change agreement that does not implode with greed? Which forms of environmental regulation most effectively align corporate and social interests? Students work through analyzing academic papers, mathematically assessing environmental policies through algebra- and calculus-based microeconomic models, and creating independent research projects. Our class is the only high school in the nation chosen to participate in the Electricity Strategy Game. Note: Intro to Microeconomics is a helpful but not required prerequisite.$rst$
WHERE id = 'd1acd09c-e076-4260-a523-b30f78896f9e';

UPDATE courses SET
  title = $rst$Drug Design$rst$,
  short_description = $rst$A lab-based introductory medicinal chemistry class exploring the design of new therapeutics. Prereq: Chemical Engineering or Bioorganic Chemistry.$rst$,
  long_description = $rst$This lab-based introductory medicinal chemistry class emphasizes the application of biological, chemical, and pharmacological concepts in the investigation of drug discovery. Medicinal chemistry deals with the discovery and design of new therapeutic chemicals and their development into useful medicines. The aim of the class is to introduce students to the basic principles of medicinal chemistry and how they are applied to the design of new therapeutics. The emphasis is that therapeutically relevant small molecules are chemical entities whose biological properties depend on chemical structure and physicochemical properties, so modifications of these properties influence biological behavior. By the end of the course, students have a greater awareness of "drug-like" properties (lipophilicity, H-bonding potential, toxicity potential) and approaches to modify pharmacological properties. Topics include spectroscopy, intro to anatomy and physiology, structure-activity relationships of antibacterials, and the relationship between structure and ADME. Prerequisites: Chemical Engineering or Bioorganic Chemistry.$rst$
WHERE id = '46891451-a0ef-406d-8028-d10305b3c474';

UPDATE courses SET
  title = $rst$Math Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired math course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'b4a4641d-2860-4048-a839-17c0df712f48';

UPDATE courses SET
  title = $rst$Chinese 3$rst$,
  short_description = $rst$A yearlong course centered on decision-making and planning themes, aiming for Intermediate Low proficiency. Prereq: Chinese 2.$rst$,
  long_description = $rst$The Chinese program provides students with opportunities to incorporate communication, collaboration, and technology skills in learning the Chinese language and its rich culture. The Level 3 Chinese course is composed of themes and units about decision-making and planning. Topics include directions, seeing a doctor, dating, living space, sports, and travel. The course roughly completes 5 units from Integrated Chinese Level 1 (Part 2). Correlated cultural topics are introduced with each unit for exploration and comparison. In addition to new vocabulary and sentence structures, students are further immersed in an authentic environment through Chinese short stories, songs, news segments, TV series, and animated videos. Students aim to achieve Intermediate Low proficiency across interpretive, interpersonal, and presentational communications (ACTFL standards). Prerequisites: Chinese 2 or equivalent.$rst$
WHERE id = '5bb1d307-9e33-4c10-9c6e-21a26d28858d';

UPDATE courses SET
  title = $rst$Chinese 2$rst$,
  short_description = $rst$A yearlong course expanding Chinese vocabulary and sentence structures, aiming for Novice High proficiency. Prereq: Chinese 1.$rst$,
  long_description = $rst$The Chinese program provides students with opportunities to incorporate communication, collaboration, and technology skills in learning China's language and its rich culture. Chinese 2 starts with an expansion of vocabulary and sentence structures built on top of Chinese 1 content through dialogue creation, reading, listening, and writing. This course completes 5 units from Integrated Chinese Level 1 (Part 1) and covers topics including making an appointment, studying Chinese, shopping, transportation, and weather. In addition to colloquial Mandarin, students are exposed to more formal written language with stories and songs. While advancing in reading and creative writing, students dive deeper into cultural comparisons and 21st-century world citizenship through group projects and comic/drama production. Students aim to achieve Novice High proficiency across interpretive, interpersonal, and presentational communications (ACTFL standards). Prerequisites: Chinese 1 or equivalent.$rst$
WHERE id = '5d974687-9961-429e-874e-cb9d0604cdb5';

UPDATE courses SET
  title = $rst$Number Theory$rst$,
  short_description = $rst$A semester study of the integers and discrete systems, with applications in cryptography and computer science.$rst$,
  long_description = $rst$Number theory is a branch of theoretical mathematics with both a wealth of recreational problems and applications in cryptography and computer science. For example, Fermat's Last Theorem and RSA encryption both have their roots in number theory. In our semester-long study of numbers, we begin by considering properties of the integers, mainly various aspects of divisibility. We also investigate other discrete systems such as modular arithmetic and rational numbers. Advanced students may have opportunities to study topics such as the Gaussian integers, quadratic residues, and Diophantine equations.$rst$
WHERE id = '21f77708-8893-45b6-85b1-6a7fdac0a633';

UPDATE courses SET
  title = $rst$Intro to Art & Fabrication$rst$,
  short_description = $rst$A semester course combining visual art and fabrication, using hand tools, power tools, and varied materials.$rst$,
  long_description = $rst$This semester-long course combines the fields of visual art and fabrication. Students in this course work in a variety of media to create projects that demonstrate understanding and consideration of craftsmanship and the elements and principles of visual art, including space, form, balance, light, and contrast. Students gain firsthand knowledge and experience with construction by using a variety of hand tools, power tools, and materials, such as the hand drill, chop saw, band saw, belt and orbital sanders, wire, foam, wood, and sheet metal. Emphasis is placed on appropriate use of tools and safety. Students create work that can range from representational to abstract; it might be inspired by historical or contemporary artists and art movements. Through readings, slide presentations, and visiting artists, students consider the context in which they are creating art. Students participate in critiques as a means to develop critical thinking skills and to further understand the meaning in their work.$rst$
WHERE id = '2eeda05a-bf8e-4d30-be2e-a0957cdf4c00';

UPDATE courses SET
  title = $rst$Strength Training$rst$,
  short_description = $rst$Builds from fundamentals of safe resistance technique, program design, mobility, and progressive training.$rst$,
  long_description = $rst$The term opens with concrete problems tied to safe resistance technique, program design, mobility, and progressive training, then widens toward independent work. Technology is used when it clarifies ideas, not as decoration—paper notebooks still matter. Fitness logs and skill checklists show measurable improvement related to safe resistance technique, program design, mobility, and progressive training.$rst$
WHERE id = 'a6376d67-1067-48de-a888-feb9b9d103b8';

UPDATE courses SET
  title = $rst$Human Development$rst$,
  short_description = $rst$Applied study of physical, cognitive, emotional, and social change across the lifespan.$rst$,
  long_description = $rst$Capstone planning begins early so students can shape personal angles on physical, cognitive, emotional, and social change across the lifespan. Collaborative days alternate with quiet independent stretches so everyone gets both voices and focus time. A final project or exam asks students to integrate what they learned about physical, cognitive, emotional, and social change across the lifespan under modest time pressure.$rst$
WHERE id = '76abd752-0149-437d-b171-37ef904b50e8';

UPDATE courses SET
  title = $rst$Free Block$rst$,
  short_description = $rst$An approved free block in the schedule for rising juniors and seniors, arranged with a college counselor or learning specialist.$rst$,
  long_description = $rst$While not available to request in the elective preference form, rising juniors and seniors are required to speak to a college counselor or learning specialist to be approved for a free block in their schedule. When approved, the student will email Ryan, copying the college counselor with whom they spoke and, as applicable, the learning specialist.$rst$
WHERE id = '6e90dccb-944a-4675-965d-0e8000cff3fa';

UPDATE courses SET
  title = $rst$Chemistry Consulting$rst$,
  short_description = $rst$A laboratory-based class where students act as real-world consultants across physical, inorganic, and analytical chemistry. Prereq: Chemistry and Math 2.$rst$,
  long_description = $rst$Chemistry Consulting is a laboratory-based class that exposes students to a wide range of chemistry and engineering disciplines through a collaborative, project-aligned curriculum featuring open-ended design, mystery, or analysis questions. The course focuses on four chemistry disciplines: physical, inorganic, analytical, and physical organic chemistry. Students pose as real-world consultants and work in groups or as a class to master the course content and habits of mind while addressing real-world problems related to polymer, solar, plastic, battery, spectroscopic, and medicinal chemistry. The year is divided approximately 85% for new chemistry topics (learning, laboratories, designing/building, homework) and 15% for consulting activities (company events, presenting work, field trips, meeting with clients). The course provides an opportunity to experience the workings of a human-centered profession, including visits to a local consulting firm. Prerequisites: Chemistry and Math 2.$rst$
WHERE id = '5d2f16e2-9636-43dc-8e70-5ec586f3c9d5';

UPDATE courses SET
  title = $rst$The Art of Repair$rst$,
  short_description = $rst$Learn hands-on repair and restoration skills for ceramics, fabric, and wood, including Kintsugi, while exploring sustainability and Right to Repair.$rst$,
  long_description = $rst$You might enjoy this class if you want to embrace imperfections like the Japanese art of Kintsugi, you are hooked on videos of craftspeople restoring things, you love making things, you are fascinated by how things are built and why they break, you care about sustainability and modern manufacturing, or you admire antiques and restorations. Familiarity with different materials is helpful. During this class, we will discover how everyday objects were made in the past vs. today, learn hands-on repair skills for ceramics, fabric, and wood, explore Kintsugi and other restoration techniques that turn damage into art, experiment with sanding, carving, and cutting wood, and explore the Right to Repair movement and why it matters.$rst$
WHERE id = 'e3336ebf-1f7d-479c-9e25-4f91cb7f30e5';

UPDATE courses SET
  title = $rst$Adv. Drawing$rst$,
  short_description = $rst$Builds on Intro to Drawing with advanced techniques such as one-, two-, and three-point perspective.$rst$,
  long_description = $rst$Advanced Drawing builds on drawing skills introduced in the first semester of Drawing. This studio course focuses on technical skill as well as mark-making as a form of creative exploration. Students will examine their interests and ideas through visual representation, working both technically and intuitively. Though class time will include lessons and discussions, students will typically be working on projects using a variety of drawing media, including (but not limited to) graphite, charcoal, and colored pencil. Studio time encourages a quiet focus and provides the necessary hours to build and refine the connection between the hand and eye. We will explore historically significant and contemporary artists, along with concepts in visual and critical studies. We will learn techniques such as, but not limited to, one, two, and three-point perspective, as well as experimenting with the alternative stylus.$rst$
WHERE id = '04a347fb-2386-481b-9827-4103b8c94d83';

UPDATE courses SET
  title = $rst$Intro to Drawing$rst$,
  short_description = $rst$A studio course focused on technical drawing skill and mark-making across a variety of media.$rst$,
  long_description = $rst$Drawing considers our perception, observation, and knowing of the world around us. It is a method of recording and expression in a visual language all its own. This studio course focuses on technical skill as well as mark-making as a form of creative exploration. Students will examine their interests and ideas through visual representation, working both technically and intuitively. Though class time will include lessons and discussions, students will typically be working on projects using a variety of drawing media, including (but not limited to) graphite, charcoal, and colored pencil. Studio time encourages a quiet focus and provides the necessary hours to build and refine the connection between the hand and eye. We will explore historically significant and contemporary artists, along with concepts in visual and critical studies. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$rst$
WHERE id = '61af6a01-dd1c-4c47-aeb5-55f80b932162';

UPDATE courses SET
  title = $rst$Design + Systems Thinking: Building a Music Festival [Not Running in 2026-27]$rst$,
  short_description = $rst$An upper-level elective co-developing an interdisciplinary festival project through design and systems thinking. Not running in 2026-27.$rst$,
  long_description = $rst$This course is for those who want to explore optimal human impact with consideration to liberation through melody, catharsis through dance and rhythm, and the healing that happens through the artist-fan connection. This upper-level elective provides the opportunity to co-develop an interdisciplinary project with advanced exploration of both design and systems thinking. A deeper understanding of human-, empathy-, and innovation-driven design thinking and the analytical, structure-based approach of systems thinking equips students to build something marvelous collaboratively. Throughout the course, small groups leverage different disciplines to deconstruct festival components including budget, venue, food, art, marketing, and the artists involved. Students practice collaboration, design thinking, budgeting, and communication through group brainstorms, criteria-based writing, design projects, a negotiation simulation, and frequent project check-ins with peer critique. The course culminates in a festival pitch presentation. Note: This course is not running in 2026-27.$rst$
WHERE id = 'a1a22291-cf1b-4ecf-97c8-fa8779cdab89';

UPDATE courses SET
  title = $rst$Entrepreneurship$rst$,
  short_description = $rst$Attention to opportunity discovery, customer research, business models, pitching, and iteration.$rst$,
  long_description = $rst$Students who enroll should be ready for sustained attention to opportunity discovery, customer research, business models, pitching, and iteration and for revising unfinished work. Reading loads stay manageable; the heavier lift is interpreting and producing original work. By the end, students should explain key ideas in opportunity discovery, customer research, business models, pitching, and iteration clearly and apply them without a scripted worksheet.$rst$
WHERE id = '258fdbd9-0f6e-43e0-8fa5-82db878a25ec';

UPDATE courses SET
  title = $rst$Intro to Microeconomics$rst$,
  short_description = $rst$Introduces the core questions, models, and tenets of microeconomics through texts, case studies, and simulations.$rst$,
  long_description = $rst$This course introduces students to the core questions, models, and tenets of microeconomics. Together, we analyze the economic rationale and consequences of choices made by consumers, businesses, and government within our broader economic system. Through academic texts, news articles, case studies, and in-class games and simulations, we expand our understanding of why economic decisions are made and how to predict and evaluate their consequences. We turn a critical eye to the neoclassical economic view while learning its inner workings. Goals include understanding consumer behavior, non-cooperative game theory, and the limits of economic rationality; predicting firm behavior in terms of price, quantity, market entry, and efficiency; analyzing market structures including competitive markets, monopolies, and oligopolies; exploring market failures; and understanding the effects of government policies on market outcomes.$rst$
WHERE id = '2c05b42b-76b0-44cc-a169-786bc69ebddb';

UPDATE courses SET
  title = $rst$English Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired English course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '4d768111-5b47-4149-bee9-e29e5acf4a67';

UPDATE courses SET
  title = $rst$History 10 - Modern World$rst$,
  short_description = $rst$A full-year study of the modern world since 1500, developing source analysis and historical argument. Prereq: History 9.$rst$,
  long_description = $rst$Students in History 10 develop skills in source analysis and historical argument by writing papers, presentations, and exhibits on the modern world since 1500. We begin by examining the world trading system that spanned from the Americas to European empires to Ming China in the sixteenth century, focusing on social, economic, and political systems like mercantilism and capitalism. We explore these systems through the commodities they delivered for European consumers and through the experiences of enslaved Africans who produced them. We end the fall by exploring the Atlantic Revolutions and the Industrial Revolution. In the spring we shift to the crises of the twentieth century, building causal arguments from timelines, presenting primary sources from the First World War, and analyzing the rise of fascism and the anticolonial struggles that followed. We end with contemporary history to understand the origins of our present day. Prerequisites: History 9.$rst$
WHERE id = '97842285-11b3-4dd4-83dc-45b9a6145dfc';

UPDATE courses SET
  title = $rst$Fine Arts Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired arts course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'b8574acd-d038-4012-8471-99cbde905931';

UPDATE courses SET
  title = $rst$Adv. Art & Fabrication$rst$,
  short_description = $rst$Builds on Intro to Art & Fabrication, deepening shop skills and artistic practice to create robust 3D art.$rst$,
  long_description = $rst$Advanced Art and Fabrication will build on skills introduced in the first semester of Art and Fabrication. Students in this course work in a variety of media to create projects that demonstrate understanding and consideration of craftsmanship and the elements and principles of visual art, including space, form, balance, texture, and contrast. Students gain firsthand knowledge and experience with construction by using a variety of hand tools, power tools, and materials, such as the hand drill, chop saw, band saw, belt and orbital sanders, wire, foam, wood, and sheet metal. Emphasis is placed on appropriate use of tools and safety. The course aims to empower artists with fundamental shop skills to create physical objects, and to introduce more mechanically-inclined students to artistic and creative processes. All students, regardless of former capabilities, will grow their knowledge of and skills in both art and fabrication by applying each in the context of the other. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$rst$
WHERE id = '96667b52-b92a-47d2-abfd-ebc0245fbead';

UPDATE courses SET
  title = $rst$Japanese 2$rst$,
  short_description = $rst$Builds on Japanese 1 to develop skills through grammar, vocabulary, kanji, and culture, aiming for Novice High proficiency. Prereq: Japanese 1.$rst$,
  long_description = $rst$Building on Japanese 1 or the equivalent, Japanese 2 is a yearlong course that develops students' reading, writing, speaking, and listening skills in Japanese through a systematic introduction and integration of grammar, vocabulary, kanji, and culture. Using a communicative approach informed by the five C's of foreign language education as defined by ACTFL, this course enables students to achieve Novice High proficiency in Japanese. Assignments and assessments focus on the three basic modes of communication: the interpersonal, the interpretive, and the presentational. Prerequisites: Japanese 1 or equivalent.$rst$
WHERE id = '93bb98aa-7d13-4265-ad16-e1a236fad6e6';

UPDATE courses SET
  title = $rst$English Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired English course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '057120c6-8d19-44c9-82cf-6f9742316a4b';

UPDATE courses SET
  title = $rst$Spanish 2$rst$,
  short_description = $rst$A yearlong course continuing Spanish acquisition with expanded vocabulary and grammar. Prereq: Spanish 1.$rst$,
  long_description = $rst$The Spanish 2 course is designed for students to continue developing the skills and practices needed for the successful acquisition of the Spanish language, broadening perspectives about communities both near and far. Students continue their study of Spanish by further expanding their knowledge of key vocabulary topics and grammar concepts. They comprehend listening and reading passages more fully and express themselves more meaningfully and with greater spontaneity in both speaking and writing. Prerequisites: Spanish 1 or equivalent.$rst$
WHERE id = 'b4825f14-a169-4239-b935-6fe34f50319a';

UPDATE courses SET
  title = $rst$Business Law$rst$,
  short_description = $rst$Emphasis on contracts, employment, consumer protection, business ethics, and legal reasoning.$rst$,
  long_description = $rst$This offering is sequenced for the grades it serves, with contracts, employment, consumer protection, business ethics, and legal reasoning as the spine of major assignments. Group roles rotate so no one is permanently the scribe or the spokesperson. A final project or exam asks students to integrate what they learned about contracts, employment, consumer protection, business ethics, and legal reasoning under modest time pressure.$rst$
WHERE id = '120381ec-ac4b-4040-b707-0e6516c27596';

UPDATE courses SET
  title = $rst$Optics & Astrophysics$rst$,
  short_description = $rst$Explore the physics of stars with a focus on optical tools such as cameras, telescopes, and spectroscopes. Prereq: Physics.$rst$,
  long_description = $rst$In this year-long class, students explore the physics of stars with a particular focus on optical tools such as cameras, ground- and space-based telescopes, and spectroscopes—all with a modern, digital twist. Physics topics include the nature of light (refraction, reflection, dispersion, polarization, interference, and diffraction); the formation, life, and death of stars (including nuclear fusion and relics such as white dwarfs, neutron stars, and black holes); the formation and observation of planetary systems (including extrasolar systems); Big Bang cosmology; dark matter and dark energy; inflation; and frontier topics that vary according to the discoveries of the day. Students take data directly with digital cameras and also make use of publicly available data for deeper study. Prerequisites: Physics.$rst$
WHERE id = '6e61f47c-b7dc-499f-9e0e-3f9ff9a3849a';

UPDATE courses SET
  title = $rst$Bioorganic Chemistry$rst$,
  short_description = $rst$Discover organic chemistry experimentally, from lab techniques to the chemistry of proteins and enzymes. Prereq: Chemistry. Coreq: Math 3.$rst$,
  long_description = $rst$The objective of this course is to discover organic chemistry, the chemistry of carbon, experimentally. Organic molecules such as petrochemicals, natural products, biomolecules, and pharmaceuticals are an integral part of our daily lives. Selected experiments present common laboratory practices and techniques, such as chromatography and distillation, and illustrate the chemistry of a wide range of functional groups. Other experiments allow students to synthesize specific compounds or explore reactions fundamental to organic synthesis: nucleophilic substitution, nucleophilic addition, electrophilic addition, esterification, and oxidation. Additional experiments emphasize discovery-based approaches, letting students develop their own protocols as they might in a research laboratory. Topics include chemical bonding and molecular structure, hydrocarbons, kinetics and energy of a reaction, stereochemistry, functional groups, reaction mechanisms, chemistry of proteins and enzymes, and an independent project. Prerequisites: Chemistry. Corequisites: Math 3.$rst$
WHERE id = 'bb4f6400-ee0f-49b4-891c-a1f68e463763';

UPDATE courses SET
  title = $rst$Intro to Macroeconomics$rst$,
  short_description = $rst$Introduces the tools and models to understand economic crises through growth, inflation, employment, and trade.$rst$,
  long_description = $rst$Macroeconomics is the study of the most pressing issues facing global economies today. This course introduces students to the tools and models necessary to understand current and historical events. Students analyze the causes and effects of economic crises through considerations of growth, inflation, employment, income, productivity, and trade. They gain insight into fiscal and monetary policy by grappling with questions such as: What policies and economic conditions led to the Great Depression and the Great Recession? Could the New Deal have rescued the United States economy if World War II had never occurred? Why was the Federal Reserve desperate to increase inflation after 2008? Who are the winners and losers of modern free trade agreements? Is it possible to achieve economic equality while maximizing economic growth?$rst$
WHERE id = 'a83c30c8-0951-49b6-b241-0ed63687d5fa';

UPDATE courses SET
  title = $rst$Yearbook Media Production$rst$,
  short_description = $rst$A yearlong course producing Nueva's annual yearbook, building skills in design, journalistic writing, and photography.$rst$,
  long_description = $rst$This yearlong course produces Nueva's annual yearbook. Yearbook offers students an exciting opportunity to further their creative interests in writing, design, and photography while acquiring highly transferable skills in journalism, print production, and visual storytelling. Skills covered include digital design (layout, theme development, and Adobe InDesign), journalistic writing (features, captions, and interviews), and digital photography (composition, shutter rate, depth of field, and Adobe Photoshop). This class emphasizes both collaboration and student leadership; students are expected to invest fully by meeting all deadlines, actively participating, fulfilling their duties as staff or editors, and contributing to the overall advancement of the yearbook theme and content.$rst$
WHERE id = '9b7dbdd3-de31-4db3-b754-b6ce2c307afe';

UPDATE courses SET
  title = $rst$Sociocultural Anthropology: Culture, Exchange, Technology Studies$rst$,
  short_description = $rst$An introduction to cultural anthropology over the last 125 years, emphasizing "thick description" of cultural practices. Prereq: History 9.$rst$,
  long_description = $rst$In this course, students receive an introduction to the development of the field of cultural anthropology over the last 125 years. A social science, anthropology is the study of humans and their culture, emphasizing "thick description" of cultural practices, such as exchange, inequality, violence, gender, kinship, mobilities, environment, and ritual. It is a large and diverse field, with practitioners using methods including archaeology, immersive ethnographic fieldwork, the study of cultural artifacts, the microanalysis of language practices, and interviews. The course begins with the origins of systemic ethnographic fieldwork and the rise of anthropology in the early 20th century, then engages with 21st-century anthropologists working on complex objects and cultures (climate change, data algorithms, capitalism, food systems). Students will do a bit of fieldwork themselves. This course suits students interested in social science closer to the humanities and those wanting a more systemic, granular approach to the study of culture. Prerequisites: History 9.$rst$
WHERE id = '4104f5bd-a1fc-4f3e-8f2f-b51c64e977cb';

UPDATE courses SET
  title = $rst$Film Studies$rst$,
  short_description = $rst$An elective built around film language, genre, history, criticism, and cultural interpretation.$rst$,
  long_description = $rst$Rather than racing through a checklist, the class returns repeatedly to film language, genre, history, criticism, and cultural interpretation until ideas feel usable. Reading loads stay manageable; the heavier lift is interpreting and producing original work. A final project or exam asks students to integrate what they learned about film language, genre, history, criticism, and cultural interpretation under modest time pressure.$rst$
WHERE id = '9c9d9bd4-a1b6-4126-a16c-b1f1d50e22af';

UPDATE courses SET
  title = $rst$Business Analytics$rst$,
  short_description = $rst$Explore the quantitative tools of management science across optimization, dynamics, and uncertainty, ending in a business plan competition.$rst$,
  long_description = $rst$This elective explores the quantitative tools of management science in different business models. The course is structured around four modules. The first three modules investigate three distinct analytic methodologies, while the final one pits students, in small groups, in a business plan competition. The first module explores "Models of Optimization," using the framework of mathematical programming; we learn to use linear inequalities to represent decision problems and exploit convexity to approximate optimal solutions. The second module examines "Models of Dynamics," using causal loop diagrams to track stocks and flows and computational tools for assessing growth behavior and path dependence. The third module introduces "Models of Uncertainty," using queueing systems and their networks; we learn about Markov Chains and design Monte Carlo simulations to propagate risk through a network of business decisions.$rst$
WHERE id = 'ebeaccbc-cd1d-45dc-8d27-cf20c4c74e09';

UPDATE courses SET
  title = $rst$Art History: A Survey$rst$,
  short_description = $rst$A survey of art history from Sumer to New York City, investigating famous and lesser-known art movements.$rst$,
  long_description = $rst$What makes something art? How does art reflect the history of ideas? Can art exist independently, without referencing art history? These are the core questions of our course, which takes us from Sumer to New York City, from 3000 BC to our current streets, and from a tiny antler carving of a reindeer to a French artist whose performance piece was to throw his payment of gold bullion into the river Seine. Along the way we investigate the most famous art movements, such as Neoclassicism, Baroque, and Abstract Expressionism, as well as some lesser-known moments in art history. We write odes to paintings, virtually explore dozens of museums together, create thematic timelines, and discuss quite a lot of art. Students should be ready to write a few analyses of art pieces or movements.$rst$
WHERE id = 'dab2cb0e-942c-44bf-8f84-876b3d97e694';

UPDATE courses SET
  title = $rst$Acting Studio$rst$,
  short_description = $rst$Seminar and studio approaches to character, objective, voice, movement, scene study, and rehearsal discipline.$rst$,
  long_description = $rst$Teachers model professional habits while students pursue character, objective, voice, movement, scene study, and rehearsal discipline in pairs and on their own. The teacher conferences mid-term to adjust challenge level without watering down standards. A final project or exam asks students to integrate what they learned about character, objective, voice, movement, scene study, and rehearsal discipline under modest time pressure.$rst$
WHERE id = 'f1c9e6d5-f547-437a-8592-b4b86ee6c195';

UPDATE courses SET
  title = $rst$Science Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired science course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '1c663d85-9517-4a60-9a06-16460bf35e1a';

UPDATE courses SET
  title = $rst$The Tie that Binds: Family Dynamics in Shakespeare$rst$,
  short_description = $rst$Examine family dynamics as catalysts in Shakespeare's plays, focusing on King Lear and The Taming of the Shrew. Prereq: English 9.$rst$,
  long_description = $rst$There is no bond like the blood bond of family, and yet there is no hatred like that within a family. Shakespeare relies on family dynamics—suitors competing for sisters, siblings vying for possession, and cousins killing for power—as catalysts and frames for several of his plays. Shakespeare's King Lear and The Taming of the Shrew both feature sisters compared and even competing against each other. Looking at King Lear, we ask whether Lear's daughters are the causes or the victims of this tragedy. While The Taming of the Shrew is a comedy, its dark undertones reveal compelling family drama, and we ask how Katherina and Bianca's relationship frames the taming narrative. We explore gender theory and Freudian theory as we read both plays, and view adaptations including 10 Things I Hate About You and excerpts from Succession. Prerequisites: English 9.$rst$
WHERE id = '748fba5c-2aa4-4ab3-b172-ca580eff649a';

UPDATE courses SET
  title = $rst$Japanese 4$rst$,
  short_description = $rst$Builds on Japanese 3, aiming for Intermediate Mid proficiency through grammar, vocabulary, kanji, and culture. Prereq: Japanese 3.$rst$,
  long_description = $rst$Building on Japanese 3 or the equivalent, Japanese 4 is a yearlong course that develops students' reading, writing, speaking, and listening skills in Japanese through a systematic introduction and integration of grammar, vocabulary, kanji, and culture. Using a communicative approach informed by the five C's of foreign language education as defined by ACTFL (Communication, Cultures, Connections, Comparisons, and Communities), this course enables students to achieve Intermediate Mid proficiency in Japanese. In assignments and assessments, equal emphasis is given to the three basic modes of communication: the interpersonal, the interpretive, and the presentational. Prerequisites: Japanese 3 or equivalent.$rst$
WHERE id = '00aa942d-dbd6-42c6-9841-00b1b3da8a5b';

UPDATE courses SET
  title = $rst$Mixed Media$rst$,
  short_description = $rst$A studio course exploring 2D processes including drawing, painting, collage, and digital media.$rst$,
  long_description = $rst$Mixed Media is a studio course that explores a range of 2D processes including (but not limited to) drawing, painting, collage, and digital media. Throughout the semester, students will utilize different surfaces and materials in both traditional and alternative methods. Working with representation and abstraction, students will be encouraged to experiment within the framework and assignments of the class. Course content will address our daily visual experiences, whether through the screens on our devices or actual objects. More specifically, we will examine texture and dimension as illusion on a flat surface through the act of art making. We will consider these modes of seeing through juxtaposing and combining digital and other 2D media. This class seeks to develop the student's sense of visual literacy and personal art practice, building technical skill and fostering independent and creative thought. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$rst$
WHERE id = '7891ee8d-328b-4b38-b2ec-67199e854db1';

UPDATE courses SET
  title = $rst$Video Game Programming$rst$,
  short_description = $rst$Make video games using the Godot game engine, covering controls, levels, enemies, items, and physics.$rst$,
  long_description = $rst$You might enjoy this course if you want to understand the process of making video games better, you like being creative and coming up with new ideas, or you like making things for other people to play with. Playing or enjoying games of any type and foundational programming skills are helpful prior experiences. During this class, we will cover the basics of the Godot game engine, controls and interaction with your game, using tilemaps to create levels, creating enemies and items, and adding physics to games. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '35390ab3-9673-4884-bb49-2fa81f2aeecc';

UPDATE courses SET
  title = $rst$Chemistry$rst$,
  short_description = $rst$Nueva's ninth-grade science: a unified introduction to the principles of chemistry, applied in hands-on ways.$rst$,
  long_description = $rst$Nueva's ninth-grade science provides a unified introduction to the principles that describe the natural world at its most fundamental level. The course aims to improve students' understanding of the world around us and to make their thinking more rigorous by introducing principles of chemistry and applying those concepts in hands-on ways to real-world examples. We also aim for students to develop a robust set of scientific practices: methods for asking questions, designing and carrying out experiments, interpreting the results, and communicating their conclusions to others. Topics studied this year include gas properties, the atomic nature of matter, bonding in materials, chemical reactions, stoichiometry, and acids and bases.$rst$
WHERE id = '55bfdcaa-616a-458f-bcd0-3fb3a2c5aa10';

UPDATE courses SET
  title = $rst$International Relations$rst$,
  short_description = $rst$Study the major theories of international relations and case studies from 1945 to the present. Prereq: History 10.$rst$,
  long_description = $rst$Why has war been such a dominant force in human history? Is the world simply a chaotic collection of self-interested states, or does an international society exist that might one day eradicate global conflict? Why do some states fail and degenerate into ethnic and sectarian strife? Can economic integration create peace? These are some of the central questions of international relations, a branch of political science. In this course we study the major theories of the discipline, including key works from the realist, liberal, and constructivist schools, and examine case studies from 1945 to the present day, spanning Russia, Europe, Asia, Africa, and the Americas. We then look to our current geopolitical moment and seek to understand what new global order is emerging. This course features student collaboration within seminar-style classes; students must be ready to present and discuss mature material, including real-time international issues. Prerequisites: History 10.$rst$
WHERE id = '8aee61fa-89f4-4c36-b30d-0440055ce65e';

UPDATE courses SET
  title = $rst$Math and Philosophy for Human Flourishing$rst$,
  short_description = $rst$Explore the interface between philosophy, mathematics, and literature in search of mathematical truth and meaning. Prereq: Math 1.$rst$,
  long_description = $rst$This elective explores the fertile interface between philosophy, mathematics, and literature, in search of the role it plays in the human condition. Our main quarry is mathematical truth and its ontology. From the economy to ecology, our bodies to the body politic, complexity is the common denominator that, paradoxically, explains what remains stubbornly just outside our comfort zone. What is the meaning of proof, or truth, in the era of polymath blogs and computer-assisted experimental mathematics? This is primarily a reading and writing course, with mathematics serving as the context. We read the musings of mathematicians as they ponder the source of meaning and purpose in their work, investigating core philosophical questions at the foundation of mathematics, from ontology and metaphysics to epistemology, ethics, and aesthetics. These investigations are always inspired by concrete mathematical explorations designed to be accessible to students with diverse mathematical backgrounds. Prerequisites: Math 1.$rst$
WHERE id = 'e4e3494b-93ee-43b2-b0b9-1eed3a69cb56';

UPDATE courses SET
  title = $rst$Core Mathematics Intensive X$rst$,
  short_description = $rst$One of two required courses in the accelerated Math 2-3 Integrated Program; taken concurrently with Core Mathematics Intensive Y. Prereq: Math 1 and department approval.$rst$,
  long_description = $rst$Core Mathematics Intensive X is one of two required courses that together comprise the Core Mathematics Intensive: Math 2-3 Integrated Program, a yearlong alternative pathway through Nueva's Core Mathematics program for students seeking a challenging course of study. The program integrates and reorders core content typically addressed across Math 2 and Math 3 into a single, coherent sequence, engaging students deeply with algebraic, geometric, and functional ideas while maintaining a demanding pace and workload. Students enrolled in this course must also enroll concurrently in Core Mathematics Intensive Y. Placement is determined by department approval based on demonstrated readiness for sustained acceleration. This program replaces the former Math 1X/Math 2X Booster program. Prerequisites: Math 1 and Math Department Approval. Corequisites: Core Mathematics Intensive Y.$rst$
WHERE id = 'e125727d-5c77-4874-b54b-5fdb65b480b0';

UPDATE courses SET
  title = $rst$Computer Vision$rst$,
  short_description = $rst$Explore how computers extract meaning from images and video, and discuss the ethics of computer vision applications.$rst$,
  long_description = $rst$You might enjoy this class if you want to explore the many ways that computers extract meaning from images and video, you are interested in investigating the ethics of computer vision applications (government surveillance, automated weapons, self-driving cars), and you enjoy choosing your own projects responsibly. Foundational programming skills are required. Topics include image representation and encoding, filters (both effects and information-extracting operations), detecting edges, features, and objects, a framework for thinking about who might be affected by computer vision technology, and advanced topics such as facial recognition, automatic image resizing, object tracking, scene graphs, and image segmentation. Note: this course will likely not run again until 2028. Prerequisites: Completion of Intro to Computer Programming or Intro to Data Analysis, or approval of instructor.$rst$
WHERE id = '16ee555e-c231-4e44-89ef-1b4f22c06231';

UPDATE courses SET
  title = $rst$Architecture of Unbreakable Homes$rst$,
  short_description = $rst$Explore future-proof, disaster-resistant housing through engineering techniques, materials, and models.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in future-proof housing, you are fascinated by architecture, engineering, or how things are built, you care about climate change and adapting to increased risks, you want to know how a house goes from empty plot to finished structure, or you like problem-solving multiple challenges at once. Experience with floorplans or small models is helpful. During this class, we will explore which parts of the U.S. are at highest risk for natural disasters, analyze common building designs and why some fail, learn key engineering techniques that make structures more disaster-resistant, learn the pros and cons of different materials, and create models to communicate ideas and iterate based on feedback.$rst$
WHERE id = '0dfad268-9dc3-4de9-b230-0b9a526020a4';

UPDATE courses SET
  title = $rst$English 10$rst$,
  short_description = $rst$A full-year course expanding reading, writing, and critical thinking, focusing on literature produced outside the West. Prereq: English 9.$rst$,
  long_description = $rst$Our goal in English 10 is to expand and deepen skills in reading, writing, critical thinking, and collaborative dialogue. Through encounters with a variety of literary texts, students will develop more sophisticated ways to analyze literary works and their devices; use writing mechanics, structure, and style to articulate ideas in various modes of writing; and communicate ideas to others. Another goal of English 10 is to examine and understand relations of culture, identity, and power by focusing on literature produced outside the West. Prerequisites: English 9.$rst$
WHERE id = '039665b8-5163-485f-b432-abc76638f5dc';

UPDATE courses SET
  title = $rst$Immunology$rst$,
  short_description = $rst$Investigate the immune system through a case-study approach, with a heavy focus on primary literature and modeling. Prereq: Biology.$rst$,
  long_description = $rst$Every day, the cells of your immune system target and destroy pathogens. The immune system is highly specialized to resist constant assault, but the tools at its disposal often cause harm to the body itself. Our course investigates the underlying function of the immune system through a case-study approach, analyzing real-life examples of how the immune system can both fight and cause disease. After a whirlwind review of cell biology, students gain a bird's-eye view of the immune system by focusing on how the components of the innate and adaptive immune system interact. We model the stages of innate immune response and investigate how dysregulation can cause Crohn's disease, perform skits to model T-cell activation, and examine the medical records of a bone marrow transplant patient to determine the role of hematopoiesis in robust immune response. With a heavy focus on primary literature and modeling, this class is an opportunity to ask and answer questions about how our own bodies function. Prerequisites: Biology.$rst$
WHERE id = 'e6854b7f-a4e1-4e4d-84bb-f357c52f2883';

UPDATE courses SET
  title = $rst$Senior Block$rst$,
  short_description = $rst$A free period assigned to all 12th-grade students in the fall to account for senior-year priorities.$rst$,
  long_description = $rst$Note: All 12th grade students are assigned a free period (i.e. "Senior Block") in their schedule to account for the myriad priorities present in the fall semester of senior year.$rst$
WHERE id = '08d123d3-6346-4a03-ad57-1e08c6ecb271';

UPDATE courses SET
  title = $rst$History 11 - US History$rst$,
  short_description = $rst$A full-year survey of the major forces shaping the United States, framed by key analytical questions. Prereq: History 10.$rst$,
  long_description = $rst$United States History is designed to provide students with a survey of the major forces which have shaped our country and to incorporate deeper contemplation of specific eras and historical schools of thought. Students explain how past events helped shape modern society while appreciating the complex connections between those events. In doing so, students engage with three key questions: Are capitalism and democracy complementary or contradictory? Is the American state a vehicle for repression or liberation? Globally, have US actions lived up to or contradicted the ideals of freedom and democracy? Rather than answering these conclusively, we use them as an analytical framework across varied case studies. Students deepen their expertise in areas of individual interest through varied readings, independent and collaborative research, and regular presentations to one another. Prerequisites: History 10.$rst$
WHERE id = '75f18cbf-d583-422f-a0e0-c0fc4177de21';

UPDATE courses SET
  title = $rst$Mechanisms of Cancer$rst$,
  short_description = $rst$Understand the pathways that control cell growth and how they are hijacked in cancer, alongside societal lenses. Prereq: Biology.$rst$,
  long_description = $rst$Together, the many thousands of genes in the human genome create a self-assembling system, a human being. All of the cells in this system use those genes in different ways, becoming constrained in where they exist, how long they exist, what they consume, and what they produce. The human genome, however, has vulnerabilities. Mutations can cause cells to redefine their previous location, lifespan, and activities; a cell like this can grow and divide without typical boundaries, creating cancer. In this class, we work to understand the pathways that control cell growth and division under normal circumstances and that are hijacked when certain cancerous mutations occur. We also explore the molecular basis for many cancer treatments. Although we spend much of our time taking a scientific approach to cancer, we also examine it through other lenses, such as personal narratives, the history of cancer, healthcare economics, and health disparities. Through creative and analytical projects, students develop paper-reading and communication skills, deepen their understanding of molecular and cellular biology, and analyze complex societal problems. Prerequisites: Biology.$rst$
WHERE id = '94e89d42-0179-41f8-908b-9303ea7002f9';

UPDATE courses SET
  title = $rst$Chinese 4$rst$,
  short_description = $rst$The fourth year of Chinese, equipping students with more complex expressions and styles, aiming for Intermediate Mid proficiency. Prereq: Chinese 3.$rst$,
  long_description = $rst$Chinese 4 is the fourth year of the Chinese program at Nueva Upper School. Its primary focus is to continuously equip students with expressions, styles, and language structures of higher complexity in both oral and written communication for various purposes. Students learn to differentiate between speaking and writing the choice of words and phrases essential for higher-level social functions. This course allows students to incorporate communication, collaboration, and technology skills in learning the Chinese language and its rich culture. Topics studied this year are travel, at the airport, starting a new semester, at a restaurant, shopping, and choosing classes. This course prepares students to achieve Intermediate Mid proficiency across interpretive, interpersonal, and presentational communications (ACTFL standards). Prerequisites: Chinese 3 or equivalent.$rst$
WHERE id = '5fc95a33-4566-4951-964d-54d794a8fe36';

UPDATE courses SET
  title = $rst$Software Engineering$rst$,
  short_description = $rst$A taste of real-world software development: prototyping, iteration, testing, documentation, and code reviews. Prereq: at least one non-intro CS elective.$rst$,
  long_description = $rst$You might enjoy this class if you have ever wondered what the difference is between programming for homework and real-world software development, you want a taste of what it is like to work in the software industry, you like using your programming ability to help people, or you enjoy choosing your own projects responsibly. Having developed an app (web, mobile, or otherwise) can be helpful but is not necessary. Topics include how to build software that people actually want, software prototyping and iteration, task estimation and prioritization, building a minimum viable product, documentation and specification, testing and development paradigms, defensive programming, and code reviews. Prerequisites: At least one non-intro computer science elective at Nueva Upper School and comfort reading and writing code in at least one programming language.$rst$
WHERE id = 'baeeeb57-aab1-415d-be59-ba833f91abf6';

UPDATE courses SET
  title = $rst$Dance$rst$,
  short_description = $rst$An energetic, physically active exploration of dance across jazz, ballet, and a class-chosen style, culminating in a performance.$rst$,
  long_description = $rst$This course is an energetic exploration of dance. Divided into three parts over the course of the semester, students will immerse themselves in three different styles of dance: jazz, ballet and a style chosen by the class (tap, hip hop, contemporary, musical theatre, modern, or any other popular requests from students). We will explore the historical background of each style of dance, watch and learn from performances and notable performers and then learn the technique of each style. This elective is physically active and students will be encouraged to explore creativity with movement. Each class will involve a warm up, a focus on dance technique and learning choreography in each style. We will end the semester in a culmination performance of at least one of our dances. Students will receive PE credit for the full year for taking this elective.$rst$
WHERE id = '18766203-c012-42fb-a80f-4f494b01b91e';

UPDATE courses SET
  title = $rst$Economics Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired economics course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = 'f79e2103-20e7-493e-94dc-ab58325b3086';

UPDATE courses SET
  title = $rst$Mixed Media$rst$,
  short_description = $rst$A studio course exploring 2D processes including drawing, painting, collage, and digital media.$rst$,
  long_description = $rst$Mixed Media is a studio course that explores a range of 2D processes including (but not limited to) drawing, painting, collage, and digital media. Throughout the semester, students will utilize different surfaces and materials in both traditional and alternative methods. Working with representation and abstraction, students will be encouraged to experiment within the framework and assignments of the class. Course content will address our daily visual experiences, whether through the screens on our devices or actual objects. More specifically, we will examine texture and dimension as illusion on a flat surface through the act of art making. We will consider these modes of seeing through juxtaposing and combining digital and other 2D media. This class seeks to develop the student's sense of visual literacy and personal art practice, building technical skill and fostering independent and creative thought. Students are strongly encouraged to participate in a culminating art show at the end of the semester.$rst$
WHERE id = '2ecca07b-54b8-4e6b-99ad-fb0885448e1f';

UPDATE courses SET
  title = $rst$Comparative Literature: Art and War$rst$,
  short_description = $rst$Examine literary and artistic responses to WWII trauma through a comparative lens, introducing comparative literature.$rst$,
  long_description = $rst$German philosopher Theodor Adorno famously wrote, "To write poetry after Auschwitz is barbaric." What are the ethics of writing about atrocity? Who can speak for the dead, and what does it mean to listen to them? This course examines these difficult questions through a comparative lens, looking at various literary and artistic responses to three forms of generational trauma created by World War II: the Holocaust in Eastern Europe, the Japanese American internment in the United States, and the atomic bombings of Hiroshima and Nagasaki. By reading works—including literature, films, graphic novels, painting, and photography—alongside each other, this course asks how art and war are related and opposed to each other. In this way, the course introduces students to the discipline of comparative literature, which identifies literary, historical, and theoretical connections across texts from different languages, cultures, and media. Projects may include short essays, creative writing, oral interviews, and independent research.$rst$
WHERE id = '94681c55-6fa4-44a6-9ba7-1e77499dc1b2';

UPDATE courses SET
  title = $rst$Intro to Music Production$rst$,
  short_description = $rst$Learn the fundamentals of music production using Ableton Live, from MIDI programming to recording and sound design.$rst$,
  long_description = $rst$Students will learn how to create any type of music that they can dream of, using imagination and the program Ableton Live. Students will learn the fundamental concepts of music production, covering everything from programming electronic compositions using MIDI to recording live instruments and vocals to designing, engineering, and automating their own sounds. Students use musical examples from the industry to understand certain concepts in digital production and learn how to design and produce music using their own sounds and patches. Course assignments include creating musical compositions or designing sounds and patches for future productions using Ableton and are flexible in regard to genre and style (electronic vs. live). The course will model a workshop environment, as we will listen to and discuss student projects as a group. At the end of the course, students produce a final original song at full length.$rst$
WHERE id = '0c8392d3-a1f7-4cc7-8f25-8a4fe0fa1857';

UPDATE courses SET
  title = $rst$Intro to Speech and Debate$rst$,
  short_description = $rst$The entry point for Nueva's competitive debate program, covering research, casewriting, and speaking skills.$rst$,
  long_description = $rst$This course is the entry point for Nueva's competitive debate program: extemporaneous speaking, impromptu speaking, parliamentary debate, public forum debate, and world schools debate. Introductory students learn basic research, casewriting, and speaking skills required for novice competition. Experienced students mentor introductory students and work on advanced theory and philosophical positions, strategy, and audience-tailored performance choices. All students compete in at least one interscholastic tournament each semester, though many more are offered. Students with no prior competition experience in at least one target event are highly encouraged to take the elective concurrently with joining the extracurricular team.$rst$
WHERE id = '2884bdad-0e34-462b-9213-e123c7b0541d';

UPDATE courses SET
  title = $rst$Work Ethics: A History$rst$,
  short_description = $rst$A history of work ethics, examining how the human relationship with work has evolved over time and across space.$rst$,
  long_description = $rst$Studs Terkel introduced his collection of interviews from working people during the 1970s by stating that "This book, being about work, is, by its very nature, about violence—to the spirit as well as to the body." His remarks hint at the relationship we often assume between work and pain. But does work have to hurt for it to be valid? How do we measure the value of work? Is labor only work when it is paid? Writing at the turn of the 20th century, Max Weber described the Protestant work ethic as the mindset that gave rise to modern capitalism. But there have been other ethics of work. This class is a history of work ethics with the goal of examining how the human relationship with work has evolved over time and across space, looking at agrarian societies, the relationship between leisure and work, and how ideas of work became intertwined with race and gender. At its core, this course explores how ideas become embedded within society as common-sense beliefs.$rst$
WHERE id = 'e878a235-129f-4d79-9963-f87b793b07c0';

UPDATE courses SET
  title = $rst$Computational Biology$rst$,
  short_description = $rst$Explore the intersection of biology and mathematics through mathematical models of biological processes. Prereq: Math 3.$rst$,
  long_description = $rst$This course explores the intersection between biology and mathematics. Students are introduced to the use of mathematical models for exploring biological processes. We investigate a diverse set of biological dynamics, including the genetic code, the relationship between structure and function of proteins, the forces that guide evolution in viruses, bacteria, and eukaryotes, population dynamics, competition and cooperation among species, metabolism and catalysis, neural excitation and inhibition, immunological memory, and origins and detection of life. The modeling process plays a central role, offering opportunities to study various mathematical concepts in context, including dynamical systems, Markov chains, random walks, and optimization. The class is structured around modules that students explore in independent groups, culminating in artifacts shared through symposia and curated into a final portfolio. Prerequisites: Math 3.$rst$
WHERE id = 'd12f0f4b-0f43-441a-b1cf-69a064dee14e';

UPDATE courses SET
  title = $rst$Film & Stage Prop Making$rst$,
  short_description = $rst$Learn how props are designed, built, painted, and finished for film, TV, cosplay, and stage.$rst$,
  long_description = $rst$You might enjoy this class if you are interested in how props are designed or made for movies, TV, cosplay, or stage productions, you are interested in learning to build and paint props, or you are interested in working with new prop-making and cosplay materials. No prior experience is required. During this class, we will cover prop design, prop layout and fabrication, painting, finishing, and weathering props, and working with fabrics, foams, plastics, and other wearable materials.$rst$
WHERE id = 'd4db243b-f377-4f9d-a2bc-515a62351666';

UPDATE courses SET
  title = $rst$Abstract Algebra$rst$,
  short_description = $rst$A gateway to advanced mathematics studying groups, fields, and rings, and learning to write mathematical proofs. No specific prerequisites.$rst$,
  long_description = $rst$This course is the canonical gateway to advanced mathematics, comprising the study of structures such as groups, fields, and rings. These abstract structures are generalizations of more familiar number systems, and allow mathematicians to devise new "numbers" and "operations" applicable in a wide array of disciplines. Abstract algebra is an excellent venue for learning to write mathematical proofs, and is indispensable in math, theoretical physics, cryptography, and more. This course requires commitment and effort but has no specific prerequisites. Any student may enroll, regardless of previous mathematical experience, as long as they are prepared to engage earnestly with the challenges presented. We study groups, subgroups, normal subgroups, quotient groups, order of elements, cosets, orbits, and fields. Students who begin with some familiarity may explore parallel notions in ring theory as well as more advanced topics such as the Sylow theorems.$rst$
WHERE id = '5e659953-33f9-45e7-ba2a-82f0fbe74c80';

UPDATE courses SET
  title = $rst$Spanish Communication$rst$,
  short_description = $rst$An advanced elective, conducted in Spanish, developing oral communication skills and interaction with native speakers. Prereq: Spanish 4.$rst$,
  long_description = $rst$Advanced Spanish Communication is an advanced elective course, conducted in Spanish, designed to help students develop a dynamic range of advanced oral communication skills and strategies and acquire the literacy skills necessary to be effective communicators with native language speakers. Students develop the communicative skills and oral expressiveness necessary to engage in a variety of real-life situations and apply their skills to issues facing Spanish-speaking communities around the world. Through close readings and analysis of colloquial texts and conversations, as well as individual and group practice, students develop proficiency in Spanish mechanics and learn to conduct research and interpersonal interviews, deliver an original speech, write on demand, and interact with native speakers. Students examine daily interactions in different Spanish-speaking communities and create cross-cultural connections between contemporary language phenomena, including advertising, journalism, sports, and slang. Prerequisites: Spanish 4 or equivalent.$rst$
WHERE id = 'f6eea488-194d-4cbf-b416-d07053cc4c52';

UPDATE courses SET
  title = $rst$Steel Drum Band$rst$,
  short_description = $rst$Develop an advanced steel drum ensemble playing complex arrangements across a variety of musical styles.$rst$,
  long_description = $rst$The steel band will explore a variety of music styles, potentially learning compositions by Trinidadian steel drum virtuoso Robert Greenidge. In addition to learning the calypso stylings of Robert's music, we will most likely do several Santana tunes as well as music by Sting and Bill Withers. While the exact composers and compositions may vary by semester, the rhythms of each style present different challenges for each section of the band. The goal of the class is to develop an advanced steel drum ensemble for the high school that will play complex arrangements in a variety of musical styles. The ensemble will perform at school and in the community throughout the year, including the upper school arts culmination in early December. Students will also research the history of the instrument, its cultural significance, its pioneers, and its greatest composers and performers. NOTE: Any and all outside school performances are mandatory.$rst$
WHERE id = 'd5f3f03a-0cc7-4085-93f8-842222fc8c10';

UPDATE courses SET
  title = $rst$Spanish 3$rst$,
  short_description = $rst$A yearlong course strengthening grammar and fluency through conversation, readings, and cultural topics. Prereq: Spanish 2.$rst$,
  long_description = $rst$Students in Spanish 3 review and strengthen their understanding of essential Spanish grammar and build on the foundation of previous courses. They expand their vocabulary and increase fluency through frequent conversational practice, presentations, readings, creative projects, and research on cultural topics. Throughout the year, students progress through the ACTFL standards, increasing their ability to express needs and wishes, write cohesive passages, and present clearly using complex sentences. Through individual and collaborative activities, students understand how life experiences shape identity, discuss cultural celebrations, consider the relationship between life and the arts, delve into social justice issues, and describe environmental challenges. Students master the preterit, imperfect, and present perfect tenses while implementing the present subjunctive, review the future and conditional tenses, and learn to express desires and give instructions using the imperative. Prerequisites: Spanish 2 or equivalent.$rst$
WHERE id = '18a74b7b-dec5-48c9-aaf2-6a857e41643b';

UPDATE courses SET
  title = $rst$Irish Literature$rst$,
  short_description = $rst$Study the arc of the Irish literary tradition, from oral folktales to modernism to contemporary psychological realism.$rst$,
  long_description = $rst$Ireland, a country you can drive across in a few hours, appears to have an outsized effect upon the literary world. It is the birthplace of literary giants such as James Joyce, Oscar Wilde, and Elizabeth Bowen. No fewer than four Nobel literature laureates and six Booker prize winners have hailed from Ireland. And then there is Sally Rooney, whose recent dominance in both literature and culture has been dubbed "the Sally Rooney Effect." What is the secret to Ireland's storytelling success? To answer this question, we will study the arc of the Irish literary tradition, from oral folktales to twentieth-century modernism to contemporary psychological realism. We will also dive into Irish history and culture to better contextualize our readings.$rst$
WHERE id = '70970cc1-bfe4-4ef5-bedb-c9296a69e981';

UPDATE courses SET
  title = $rst$Hit Harmonics: Studio Recording from Idea to Record$rst$,
  short_description = $rst$A studio-based course exploring how songs are built and why they resonate, through analysis, ear training, and hands-on production.$rst$,
  long_description = $rst$Hit Harmonics is a studio-based music course exploring how songs are built and why they resonate. Through close listening, song analysis, ear training, lyric study, and hands-on production, students examine the rhythmic, harmonic, lyrical, melodic, and structural choices that shape emotional impact. Using the full capabilities of the Upper School recording studio, students analyze influential recordings and apply those insights through original compositions, creative reinterpretations, and the collaborative production of a class-built track. Throughout the semester, students contribute to a shared class sound library, developing a curated collection of grooves, harmonies, textures, and recorded material that becomes a living resource for composition. By semester's end, students will have produced finished works, including a collaborative class song, and developed a deeper understanding of how musical decisions shape the listener's experience.$rst$
WHERE id = '4b0b01df-0737-4c35-9185-62e6e01c86e0';

UPDATE courses SET
  title = $rst$Advanced Mechanics$rst$,
  short_description = $rst$An in-depth, calculus-based study of mechanics and elements of mechanical engineering. Prereq: Physics and Calculus.$rst$,
  long_description = $rst$This course represents an in-depth study of mechanics, including the mathematical tools of calculus and elements of mechanical engineering. Unlike the treatment in first-year physics, where objects are usually approximated as point masses or as having infinite stiffness, here we consider an object's center of mass, rotational inertia, modulus of elasticity, or other properties. Students solve problems of substantially greater complexity than those in earlier classes. We also aim for students to develop a robust set of scientific practices. Students explore physics experimentally whenever practical; when a phenomenon is not tractable to classroom demonstration, digital simulations are employed. Topics include kinematics, dynamics, center of mass, impulse and momentum, conservation and transformations of energy, gravity, rotation and rolling, and oscillations and waves. Prerequisites: Physics and Calculus.$rst$
WHERE id = '30f45c72-bb0e-4c66-84be-947d252282ec';

UPDATE courses SET
  title = $rst$Anatomy and Physiology$rst$,
  short_description = $rst$A yearlong exploration of the human body's structure and function, with dissections, histology, and imaging. Prereq: Biology.$rst$,
  long_description = $rst$Anatomy and Physiology is a yearlong exploration of the human body's structure and function, designed for students interested in medicine, exercise science, or simply understanding how their body works. In the fall semester, we investigate how the body's organization supports life's essential functions, beginning with cell theory, structure-function relationships, and levels of organization. Students engage in hands-on experiences such as dissections, histology slide analyses, medical imaging studies, and interactive labs. In the spring semester, students cross-apply fall concepts with new concepts that govern how physiological systems work together in a whole organism, such as homeostasis and interdependence. By applying their knowledge to novel scenarios—including unfamiliar organ systems and even other species—students build adaptability, problem-solving skills, and confidence. Across both semesters, the skill focus is on developing critical thinking and research-backed study techniques tailored to each student. Prerequisites: Biology.$rst$
WHERE id = '6e9485cf-4aad-4734-8f6d-25dd3813a772';

UPDATE courses SET
  title = $rst$Biology Research Teams 2$rst$,
  short_description = $rst$A student-led advanced research course where teams propose and pursue novel, long-term biology research projects. Prereq: Biology Research Teams 1.$rst$,
  long_description = $rst$In Biology Research Teams 2, students propose novel, long-term research projects to experimentally address significant scientific questions, and they pursue a subset of these projects in small, student-led groups over the course of 1 to 2 years. These research projects in molecular, cellular, and behavioral biology are significant (often presented at a scientific conference); they are created, pushed forward, and led by students; they are iterative; and they allow student leaders to train their peers in a structured process guided by the teachers. The reading of scientific literature, theoretical understanding of the scientific process, and hands-on experimental training from Biology Research Teams 1 allow teams to collaboratively drive a multi-faceted research project forward. All students practice project management and reverse design skills, while team leads develop their ability to coordinate, mentor, and inspire their team. Students learn to write about, display, and present their data through lab meetings, scientific posters, and written abstracts. Prerequisites: Biology Research Teams 1.$rst$
WHERE id = 'e57312f3-8119-441e-af2f-a62b9462c4cc';

UPDATE courses SET
  title = $rst$Advanced Machine Learning$rst$,
  short_description = $rst$Builds on Intro Machine Learning to explore neural networks for regression, classification, and image identification. Prereq: at least one non-intro CS elective.$rst$,
  long_description = $rst$You might enjoy this course if you enjoyed Intro Machine Learning, you are curious about how neural networks work, or you want to see math concepts applied outside of math classes. Helpful prior experience includes Intro Machine Learning, comfort thinking conceptually about math, working with data in numpy and pandas, and comfort reading and writing code in at least one programming language. During this class, we will cover dense neural networks for regression and classification, convolutional networks for image identification, and training and tuning neural networks. Prerequisites: At least one non-intro computer science elective at Nueva Upper School.$rst$
WHERE id = '5169b1c8-16c7-4633-a244-61ef621ba39b';

UPDATE courses SET
  title = $rst$Free Block$rst$,
  short_description = $rst$An approved free block in the schedule for rising juniors and seniors, arranged with a college counselor or learning specialist.$rst$,
  long_description = $rst$While not available to request in the elective preference form, rising juniors and seniors are required to speak to a college counselor or learning specialist to be approved for a free block in their schedule. When approved, the student will email Ryan, copying the college counselor with whom they spoke and, as applicable, the learning specialist.$rst$
WHERE id = '3144dc81-5bf7-4d4d-9756-a5b26269f212';

UPDATE courses SET
  title = $rst$History Teaching Fellowship$rst$,
  short_description = $rst$A teaching fellowship for students who have successfully completed the desired history course. Application per the Teaching Fellow Program Overview.$rst$,
  long_description = $rst$Teaching Fellowships give experienced students the opportunity to support the teaching of a course they have successfully completed. Students will not indicate interest in a Teaching Fellowship using the Course Preference Form. Instead, interested students should complete the Course Preference Form with all elective preferences by the deadline, then follow the guidance and action steps outlined in the Teaching Fellow Program Overview. Prerequisites: 1) Successful completion of the desired course; 2) Read the Teaching Fellow Program Overview for program details, expectations, and timeline.$rst$
WHERE id = '9af47820-ec79-4d26-93e9-e9cfe5fc56ce';

-- ------------------------------------------------------------------
-- 1 row (test school, not Nueva) could not be matched to a single seed
-- course and was left unchanged. Review manually:
--   id=f7b9c669-1f51-4de6-afa9-6b0839a9de38 school=7e570000-0000-4000-a000-000000000000 subject=Science title-pattern='Atlas'

----------------------------------------------------------------------
-- 2. Verify the restore before committing
----------------------------------------------------------------------
DO $$
DECLARE
  v_left int;
BEGIN
  -- Only the unmatched test-school row above may still read "Atlas".
  SELECT count(*) INTO v_left
  FROM public.courses
  WHERE (title ~* '\matlas\M' OR short_description ~* '\matlas\M' OR long_description ~* '\matlas\M')
    AND id <> 'f7b9c669-1f51-4de6-afa9-6b0839a9de38';
  IF v_left > 0 THEN
    RAISE EXCEPTION 'Restore incomplete: % course rows still corrupted', v_left;
  END IF;

  -- The one row that was letter-scrambled instead of "atlas"-replaced.
  IF NOT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = '21db42e2-6aa6-4f10-b78f-f420ccc972c5'
      AND title = 'Sports and Entertainment Management'
  ) THEN
    RAISE EXCEPTION 'Restore incomplete: scrambled test2 row was not restored';
  END IF;
END $$;

COMMIT;

-- Informational: expect 1 (the unmatched test-school row listed above).
SELECT count(*) AS still_corrupted
FROM courses
WHERE title ~* '\matlas\M';