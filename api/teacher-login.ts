// Vercel serverless function: teacher gate login and school creation.
// Self-contained (no imports outside api/) so Vercel's function bundler includes everything.
//
// The browser never sees a password or a hash. It posts the typed password
// here, the comparison happens inside Postgres via verify_school_password
// (service role only), and on success this returns a short-lived HMAC-signed
// token that /api/teacher-mutate requires for every write.

import { createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type SchoolPayload = {
  name?: string;
  website?: string;
  city?: string;
  state?: string;
  password?: string;
  rankings?: number;
  /** Already serialized `schools.grade` object. */
  grade?: unknown;
};

type Payload = {
  action?: string;
  schoolId?: string;
  password?: string;
  school?: SchoolPayload;
  /** Ordered term names for a brand-new school. */
  terms?: unknown;
};

/** Service-role client. Wrapped so `Supabase` below infers a concrete type. */
function createServiceClient() {
  const url = (process.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Supabase = ReturnType<typeof createServiceClient>;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sessionSecret(): string {
  // Falls back to the service role key so a missing env var cannot silently
  // downgrade signing to a guessable constant.
  return (
    process.env.TEACHER_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** `base64url(payload).base64url(hmac)` over `{ sid, exp }`. */
function signSession(schoolId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const body = base64url(JSON.stringify({ sid: schoolId, exp: expiresAt }));
  const signature = base64url(
    createHmac("sha256", sessionSecret()).update(body).digest(),
  );
  return { token: `${body}.${signature}`, expiresAt };
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return err instanceof Error ? err.message : fallback;
}

export async function POST(request: Request): Promise<Response> {
  const missing: string[] = [];
  if (!process.env.VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    return json(
      { error: `Server is missing required environment variables: ${missing.join(", ")}` },
      500,
    );
  }
  if (!sessionSecret()) {
    return json({ error: "Server is missing TEACHER_SESSION_SECRET." }, 500);
  }

  const supabase = createServiceClient();

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (payload.action === "createSchool") {
    return createSchool(supabase, payload);
  }
  if (payload.action !== "login") {
    return json({ error: "Unknown action" }, 400);
  }

  if (!isUuid(payload.schoolId)) {
    return json({ error: "Select a school first." }, 400);
  }

  const { data, error } = await supabase.rpc("verify_school_password", {
    p_school_id: payload.schoolId,
    p_password: typeof payload.password === "string" ? payload.password : "",
  });

  if (error) {
    if ((error.message ?? "").includes("school_locked")) {
      return json(
        { error: "Too many attempts. Try again in 15 minutes." },
        429,
      );
    }
    console.error("teacher login error:", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  if (data !== true) {
    return json({ error: "Incorrect password for this school." }, 401);
  }

  const { token, expiresAt } = signSession(payload.schoolId);
  return json({ token, expiresAt }, 200);
}

/**
 * Creates a school plus its terms and password hash. Unauthenticated by
 * design — the gate lets anyone add a school — and returns a session token so
 * the creator can start editing without a second round trip.
 */
async function createSchool(
  supabase: Supabase,
  payload: Payload,
): Promise<Response> {
  const input = payload.school ?? {};
  const name = text(input.name);
  const password = typeof input.password === "string" ? input.password : "";

  if (!name) return json({ error: "School name is required." }, 400);
  if (!password.trim()) {
    return json({ error: "A teacher password is required." }, 400);
  }

  const termNames = Array.isArray(payload.terms)
    ? payload.terms.map(text).filter((n) => n.length > 0)
    : [];

  try {
    const { data, error } = await supabase
      .from("schools")
      .insert({
        name,
        website: text(input.website),
        city: text(input.city),
        state: text(input.state),
        rankings: typeof input.rankings === "number" ? input.rankings : 8,
        grade: input.grade ?? {},
      })
      .select("id, name")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Failed to create school");

    const schoolId = data.id as string;

    const { error: secretError } = await supabase.rpc("set_school_password", {
      p_school_id: schoolId,
      p_password: password,
    });
    if (secretError) {
      // A school without a password hash could never be unlocked, so undo it.
      await supabase.from("schools").delete().eq("id", schoolId);
      throw secretError;
    }

    if (termNames.length > 0) {
      const { error: termsError } = await supabase.from("terms").insert(
        termNames.map((termName, index) => ({
          school_id: schoolId,
          name: termName,
          position: index,
        })),
      );
      if (termsError) throw termsError;
    }

    const { token, expiresAt } = signSession(schoolId);
    return json(
      { schoolId, name: data.name as string, token, expiresAt },
      200,
    );
  } catch (err) {
    console.error("create school error:", err);
    return json({ error: toMessage(err, "Failed to create school") }, 500);
  }
}
