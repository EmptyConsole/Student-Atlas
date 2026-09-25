-- Lock the student tables to the server.
--
-- Every student read and write now goes through /api/student, which checks the
-- student session from /api/verify-email-code and uses the service role. The
-- anon/publishable key gets no access at all to student tables: no reads (names
-- and emails stay private) and no writes.
--
-- Also makes the legacy catalog link tables (graduation_requirements,
-- course_prerequisites, course_corequisites) read-only for anon, matching the
-- other catalog tables in scripts/teacher-auth.sql.
--
-- Run AFTER the /api/student version of the app is deployed. The old client
-- writes student tables with the anon key and stops working once this runs.
--
-- Supersedes the deleted submitted-courses-rls.sql / submitted-notes-rls.sql,
-- which granted anon full access. Safe to re-run. Wrapped in a transaction; the
-- final check rolls everything back if anything is still open.

BEGIN;

----------------------------------------------------------------------
-- 1. Student tables: service role only
----------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  r record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'students', 'completed_courses', 'enrolled_courses', 'bookmarked_courses',
    'course_notes', 'submitted_courses', 'submitted_notes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, v_table);
    END LOOP;

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', v_table);

    -- Column-level grants survive a table-level REVOKE.
    FOR r IN
      SELECT DISTINCT grantee, privilege_type, column_name
      FROM information_schema.column_privileges
      WHERE table_schema = 'public'
        AND table_name = v_table
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
    LOOP
      EXECUTE format('REVOKE %s (%I) ON TABLE public.%I FROM %s',
        r.privilege_type, r.column_name, v_table,
        CASE WHEN r.grantee = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.grantee) END);
    END LOOP;

    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 2. Legacy catalog link tables: anon may only SELECT
----------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  r record;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'graduation_requirements', 'course_prerequisites', 'course_corequisites'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);

    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, v_table);
    END LOOP;

    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM anon, authenticated, PUBLIC',
      v_table
    );

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

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_select_' || v_table, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'anon_select_' || v_table, v_table
    );
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 3. Verify before committing
----------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
  v_role text;
  v_priv text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'students', 'completed_courses', 'enrolled_courses', 'bookmarked_courses',
    'course_notes', 'submitted_courses', 'submitted_notes',
    'graduation_requirements', 'course_prerequisites', 'course_corequisites'
  ]
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

      IF v_table IN ('graduation_requirements', 'course_prerequisites', 'course_corequisites') THEN
        IF NOT has_table_privilege(v_role, 'public.' || v_table, 'SELECT') THEN
          RAISE EXCEPTION 'Lockdown broke reads: % cannot SELECT %', v_role, v_table;
        END IF;
      ELSIF has_any_column_privilege(v_role, 'public.' || v_table, 'SELECT') THEN
        RAISE EXCEPTION 'Lockdown failed: % can still read %', v_role, v_table;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
