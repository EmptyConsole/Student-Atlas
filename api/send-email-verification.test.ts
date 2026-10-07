import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.RESEND_API_KEY = "resend-key";

/** Every table operation the handler performed, in order. */
const ops = vi.hoisted(() => [] as string[]);
/** Every `.ilike(column, pattern)` filter, as `table.column~pattern`. */
const likes = vi.hoisted(() => [] as string[]);
/** Addresses handed to Resend. */
const sent = vi.hoisted(() => [] as string[]);
let mockSchoolRow: { id: string; google_domains?: string[] } | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (table: string) => tableBuilder(table) }),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: ({ to }: { to: string }) => {
        sent.push(to);
        return Promise.resolve({ error: null });
      },
    };
  },
}));

/** Minimal stand-in for a PostgREST query builder: chainable and thenable. */
function tableBuilder(table: string) {
  let verb = "select";
  const finish = (_single = false) => {
    ops.push(`${verb} ${table}`);
    if (table === "schools") {
      return Promise.resolve({
        data: mockSchoolRow,
        error: null,
      });
    }
    // A non-empty students row keeps the `login` path going past its 404.
    return Promise.resolve({
      data: table === "students" && verb === "select" ? [{ id: "student-1" }] : null,
      error: null,
    });
  };

  const builder = {
    select: () => builder,
    update: () => ((verb = "update"), builder),
    insert: () => ((verb = "insert"), builder),
    eq: () => builder,
    is: () => builder,
    limit: () => builder,
    ilike: (column: string, pattern: unknown) => {
      likes.push(`${table}.${column}~${String(pattern)}`);
      return builder;
    },
    maybeSingle: () => finish(true),
    single: () => finish(true),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      finish().then(resolve, reject),
  };
  return builder;
}

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/send-email-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const { POST } = await import("./send-email-verification");

beforeEach(() => {
  ops.length = 0;
  likes.length = 0;
  sent.length = 0;
  mockSchoolRow = null;
});

describe("school domain restrictions", () => {
  const SCHOOL_ID = "00000000-0000-0000-0000-000000000001";

  it("allows signup when the school has no configured domains", async () => {
    mockSchoolRow = { id: SCHOOL_ID, google_domains: [] };
    const res = await post({
      purpose: "signup",
      email: "student@anywhere.com",
      schoolId: SCHOOL_ID,
    });
    expect(res.status).toBe(200);
    expect(sent).toEqual(["student@anywhere.com"]);
  });

  it("blocks signup when email domain does not match school domains", async () => {
    mockSchoolRow = { id: SCHOOL_ID, google_domains: ["myschool.org"] };
    const res = await post({
      purpose: "signup",
      email: "student@gmail.com",
      schoolId: SCHOOL_ID,
    });
    expect(res.status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  it("allows signup when email domain matches school domains", async () => {
    mockSchoolRow = { id: SCHOOL_ID, google_domains: ["myschool.org"] };
    const res = await post({
      purpose: "signup",
      email: "student@myschool.org",
      schoolId: SCHOOL_ID,
    });
    expect(res.status).toBe(200);
    expect(sent).toEqual(["student@myschool.org"]);
  });

  it("allows signup with a subdomain of a configured school domain", async () => {
    mockSchoolRow = { id: SCHOOL_ID, google_domains: ["myschool.org"] };
    const res = await post({
      purpose: "signup",
      email: "student@students.myschool.org",
      schoolId: SCHOOL_ID,
    });
    expect(res.status).toBe(200);
    expect(sent).toEqual(["student@students.myschool.org"]);
  });
});

describe("email lookup escaping", () => {
  it("escapes `%` and `_` so the address matches exactly", async () => {
    const res = await post({ purpose: "login", email: "a_d%a@example.com" });
    expect(res.status).toBe(200);
    expect(likes).toEqual(["students.email~a\\_d\\%a@example.com"]);
  });

  it("refuses an address carrying a `*`, which PostgREST would read as `%`", async () => {
    const res = await post({ purpose: "login", email: "*@example.com" });
    expect(res.status).toBe(400);
    // Nothing queried, no code row written, no mail sent.
    expect(ops).toHaveLength(0);
    expect(likes).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("still reports an unknown address as not found", async () => {
    const res = await post({ purpose: "login", email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(likes).toEqual(["students.email~nobody@example.com"]);
  });

  it("checks the new address for reuse on an email change", async () => {
    const res = await post({ purpose: "email_change", email: "taken_x@example.com" });
    expect(res.status).toBe(409);
    expect(likes).toEqual(["students.email~taken\\_x@example.com"]);
  });
});
