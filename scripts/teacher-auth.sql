-- Teacher authentication hardening
--
-- Before this script the teacher gate compared a plaintext password in the
-- browser, which meant the correct password was readable from any DevTools
-- network panel, and the anon role could write to the catalog tables directly
-- without passing the gate at all.
--
-- This script:
--   1. Moves school passwords into public.school_secrets as bcrypt hashes and
--      drops schools.password, so no client-readable table holds a credential.
--   2. Adds verify_school_password / set_school_password, granted to
--      service_role only, so the comparison happens in Postgres and the hash
--      never leaves the database.
--   3. Revokes anon INSERT/UPDATE/DELETE on the catalog tables and anon
--      EXECUTE on the teacher-only RPCs. Teacher writes now go through
--      /api/teacher-mutate with the service role key.
--
-- Student-flow tables (students, completed_courses, enrolled_courses,
-- bookmarked_courses, course_notes, submitted_courses, submitted_notes) are
-- deliberately untouched: the student app still writes to them with the anon
-- key. Teacher cascade deletes that reach those tables now run server-side
-- with the service role, which bypasses RLS.
--
-- Idempotent. Run in the Supabase SQL Editor (Dashboard -> SQL -> New query).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pgcrypto lives in `extensions` on Supabase and in `public` elsewhere; cover
-- both so crypt()/gen_salt() resolve either way.
SET LOCAL search_path = public, extensions, pg_temp;

----------------------------------------------------------------------
-- 1. school_secrets
--
-- RLS is enabled with no policies and client roles are revoked, so only
-- service_role (which bypasses RLS) can read or write hashes.
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_secrets (
  school_id uuid NOT NULL,
  password_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT school_secrets_pkey PRIMARY KEY (school_id),
  CONSTRAINT school_secrets_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);

ALTER TABLE public.school_secrets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.school_secrets FROM anon, authenticated;
GRANT ALL ON TABLE public.school_secrets TO service_role;

----------------------------------------------------------------------
-- 2. Migrate existing plaintext passwords, then drop the column
--
-- Guarded on the column still existing so re-running is safe. Schools whose
-- password was never set get a hash of the empty string, matching the old
-- default and the old comparison behaviour.
----------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'password'
  ) THEN
    EXECUTE $mig$
      INSERT INTO public.school_secrets (school_id, password_hash)
      SELECT s.id, crypt(COALESCE(s.password, ''), gen_salt('bf', 10))
      FROM public.schools s
      ON CONFLICT (school_id) DO NOTHING
    $mig$;

    EXECUTE 'ALTER TABLE public.schools DROP COLUMN password';

    RAISE NOTICE 'Migrated schools.password into school_secrets and dropped the column.';
  ELSE
    RAISE NOTICE 'schools.password already dropped; skipping migration.';
  END IF;
END $$;

-- Any school created before this script but missing a secret (or created by a
-- path that bypassed the API) gets an empty password rather than being locked
-- out of its own gate.
INSERT INTO public.school_secrets (school_id, password_hash)
SELECT s.id, crypt('', gen_salt('bf', 10))
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.school_secrets sec WHERE sec.school_id = s.id
);

----------------------------------------------------------------------
-- 3. Password functions
--
-- SECURITY DEFINER so they can read school_secrets under RLS, with a pinned
-- search_path so a caller-controlled path cannot shadow crypt().
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_school_password(
  p_school_id uuid,
  p_password text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_hash text;
  v_attempts integer;
  v_locked timestamp with time zone;
  v_ok boolean;
BEGIN
  SELECT password_hash, failed_attempts, locked_until
  INTO v_hash, v_attempts, v_locked
  FROM public.school_secrets
  WHERE school_id = p_school_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_locked IS NOT NULL AND v_locked > now() THEN
    RAISE EXCEPTION 'school_locked'
      USING ERRCODE = 'P0001';
  END IF;

  v_ok := (v_hash = crypt(COALESCE(p_password, ''), v_hash));

  IF v_ok THEN
    UPDATE public.school_secrets
    SET failed_attempts = 0, locked_until = NULL
    WHERE school_id = p_school_id
      AND (failed_attempts <> 0 OR locked_until IS NOT NULL);
  ELSE
    UPDATE public.school_secrets
    SET
      failed_attempts = v_attempts + 1,
      locked_until = CASE
        WHEN v_attempts + 1 >= 10 THEN now() + interval '15 minutes'
        ELSE locked_until
      END
    WHERE school_id = p_school_id;
  END IF;

  RETURN v_ok;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.set_school_password(
  p_school_id uuid,
  p_password text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.school_secrets (school_id, password_hash)
  VALUES (p_school_id, crypt(COALESCE(p_password, ''), gen_salt('bf', 10)))
  ON CONFLICT (school_id) DO UPDATE
  SET
    password_hash = EXCLUDED.password_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now();
END;
$fn$;

-- Only the server (service role key) may call these.
REVOKE ALL ON FUNCTION public.verify_school_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_school_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_school_password(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_school_password(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_school_password(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_school_password(uuid, text) TO service_role;

----------------------------------------------------------------------
-- 4. Catalog tables: anon reads, nobody but the server writes
----------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['schools', 'departments', 'courses', 'teachers', 'terms']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_insert_' || v_table, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_update_' || v_table, v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_delete_' || v_table, v_table);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_select_' || v_table, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      'anon_select_' || v_table,
      v_table
    );

    -- Belt and braces: revoke the table grant as well, so a future permissive
    -- policy cannot silently re-open writes.
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM anon, authenticated',
      v_table
    );
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

----------------------------------------------------------------------
-- 5. Teacher-only RPCs
--
-- These mutate rosters and schedules, so they are now server-side only.
-- apply_elective_assignments is left alone; it is CLI-only today.
----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.reorder_terms(uuid, uuid[])
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_class_time(uuid, int, int, int)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.edit_class_time(uuid, int, int, int, int, int, int)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_class_time(uuid, int, int, int)
  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_class_times(uuid)
  FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reorder_terms(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_class_time(uuid, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.edit_class_time(uuid, int, int, int, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_class_time(uuid, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_class_times(uuid) TO service_role;

----------------------------------------------------------------------
-- 6. Verification
----------------------------------------------------------------------
DO $$
DECLARE
  v_write_policies int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'password'
  ) THEN
    RAISE EXCEPTION 'schools.password still exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.schools s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_secrets sec WHERE sec.school_id = s.id
    )
  ) THEN
    RAISE EXCEPTION 'Some schools have no row in school_secrets';
  END IF;

  SELECT COUNT(*) INTO v_write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('schools', 'departments', 'courses', 'teachers', 'terms')
    AND cmd <> 'SELECT'
    AND roles::text[] && ARRAY['anon', 'authenticated', 'public'];

  IF v_write_policies > 0 THEN
    RAISE EXCEPTION 'anon still has % write policies on the catalog tables', v_write_policies;
  END IF;

  RAISE NOTICE 'Teacher auth hardening installed OK.';
END $$;

COMMIT;
