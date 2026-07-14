-- Email verification one-time codes (hashed). Used by Vercel API routes with
-- the service role key. Run in the Supabase SQL Editor.
--
-- Anon / authenticated must not read or write this table. RLS is enabled with
-- no policies; only the service role (which bypasses RLS) can access rows.

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  purpose text NOT NULL,
  code_hash text NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_codes_pkey PRIMARY KEY (id),
  CONSTRAINT email_verification_codes_purpose_check
    CHECK (purpose IN ('signup', 'login', 'email_change'))
);

CREATE INDEX IF NOT EXISTS email_verification_codes_email_purpose_idx
  ON public.email_verification_codes (email, purpose);

CREATE INDEX IF NOT EXISTS email_verification_codes_expires_at_idx
  ON public.email_verification_codes (expires_at);

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke client roles; service_role retains full access.
REVOKE ALL ON TABLE public.email_verification_codes FROM anon, authenticated;
GRANT ALL ON TABLE public.email_verification_codes TO service_role;
