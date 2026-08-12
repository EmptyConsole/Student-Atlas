-- Queue of emails that Resend could not deliver (e.g. free-tier exhausted).
-- Used by Vercel API routes with the service role key. Run in the Supabase
-- SQL Editor.
--
-- When Resend recovers, the next successful send flushes pending rows into
-- one digest email to consoleempty@gmail.com.
--
-- Anon / authenticated must not read or write this table. RLS is enabled with
-- no policies; only the service role (which bypasses RLS) can access rows.

CREATE TABLE IF NOT EXISTS public.skipped_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  intended_to text NOT NULL,
  detail text,
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT skipped_emails_pkey PRIMARY KEY (id),
  CONSTRAINT skipped_emails_kind_check
    CHECK (kind IN ('otp_signup', 'otp_login', 'otp_email_change', 'rankings'))
);

CREATE INDEX IF NOT EXISTS skipped_emails_notified_at_idx
  ON public.skipped_emails (notified_at)
  WHERE notified_at IS NULL;

ALTER TABLE public.skipped_emails ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke client roles; service_role retains full access.
REVOKE ALL ON TABLE public.skipped_emails FROM anon, authenticated;
GRANT ALL ON TABLE public.skipped_emails TO service_role;
