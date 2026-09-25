import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-student-session-secret";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.STUDENT_SESSION_SECRET = SECRET;

const STUDENT_A = "aaaaaaaa-0000-4000-a000-000000000001";
const STUDENT_B = "bbbbbbbb-0000-4000-a000-000000000002";
const SCHOOL = "5c000000-0000-4000-a000-000000000000";
const COURSE = "c0000000-0000-4000-a000-000000000001";

/** Every table operation the handler performed, in order. */
const ops = vi.hoisted(() => [] as string[]);
/** Every `.eq(column, value)` filter, as `table.column=value`. */
const filters = vi.hoisted(() => [] as string[]);

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => tableBuilder(table),
  }),
}));

/**
 * Minimal stand-in for a PostgREST query builder: chainable, thenable, and it
 * records `<verb> <table>` when a query is finally awaited.
 */
function tableBuilder(table: string) {
  let verb = "select";
  let chained = false;
  const finish = (single: boolean) => {
    ops.push(`${verb} ${table}`);
    return Promise.resolve({ data: rowsFor(table, verb, single), error: null });
  };

  const builder = {
    select: () => {
      if (!chained) verb = "select";
      return builder;
    },
    delete: () => ((verb = "delete"), (chained = true), builder),
    update: () => ((verb = "update"), (chained = true), builder),
    insert: () => ((verb = "insert"), (chained = true), builder),
    eq: (column: string, value: unknown) => {
      filters.push(`${table}.${column}=${String(value)}`);
      return builder;
    },
    in: () => builder,
    ilike: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => finish(true),
    single: () => finish(true),
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => finish(false).then(resolve, reject),
  };
  return builder;
}

function rowsFor(table: string, verb: string, single: boolean) {
  if (verb !== "select") return single ? { id: STUDENT_A } : null;
  if (table === "students" && single) {
    return { id: STUDENT_A, name: "Ada", email: "ada@example.com", grade: 10, school_id: SCHOOL };
  }
  if (table === "schools" && single) return { id: SCHOOL };
  if (table === "courses") return [{ id: COURSE, title: "Biology" }];
  return single ? null : [];
}

function sign(payload: Record<string, unknown>, prefix = "student."): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(`${prefix}${body}`).digest("base64url");
  return `${body}.${signature}`;
}

function session(studentId: string, exp = Date.now() + 60_000): string {
  return sign({ typ: "session", stu: studentId, exp });
}

function proof(purpose: string, email: string, exp = Date.now() + 60_000): string {
  return sign({ typ: "proof", purpose, email, exp });
}

function post(body: unknown, token?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/student", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

const { POST } = await import("./student");

beforeEach(() => {
  ops.length = 0;
  filters.length = 0;
});

describe("student session", () => {
  it("rejects a request with no token", async () => {
    const res = await post({ action: "load" });
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects a token whose signature does not match", async () => {
    const [body] = session(STUDENT_A).split(".");
    const res = await post({ action: "load" }, `${body}.forged`);
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    const res = await post({ action: "load" }, session(STUDENT_A, Date.now() - 1000));
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects a teacher-style token signed with the same secret", async () => {
    const teacherToken = sign({ sid: STUDENT_A, exp: Date.now() + 60_000 }, "");
    const res = await post({ action: "load" }, teacherToken);
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects an email proof used as a session", async () => {
    const res = await post({ action: "load" }, proof("signup", "ada@example.com"));
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });
});

describe("student scoping", () => {
  it("only touches the token's student, whatever the body claims", async () => {
    const res = await post(
      { action: "saveBookmarks", studentId: STUDENT_B, student_id: STUDENT_B, courseIds: [COURSE] },
      session(STUDENT_A),
    );
    expect(res.status).toBe(200);
    expect(ops).toContain("delete bookmarked_courses");
    expect(filters.some((f) => f.includes(STUDENT_B))).toBe(false);
    expect(filters).toContain(`bookmarked_courses.student_id=${STUDENT_A}`);
  });

  it("deletes child rows before the student row", async () => {
    const res = await post({ action: "deleteAccount" }, session(STUDENT_A));
    expect(res.status).toBe(200);
    const deletes = ops.filter((op) => op.startsWith("delete "));
    expect(deletes.at(-1)).toBe("delete students");
    expect(deletes).toHaveLength(7);
    expect(filters.some((f) => f.includes(STUDENT_B))).toBe(false);
  });
});

describe("saveProfile", () => {
  const profile = { action: "saveProfile", name: "Ada", grade: 11, schoolId: SCHOOL };

  it("saves name, grade, and school when the email is unchanged", async () => {
    const res = await post({ ...profile, email: "ADA@example.com" }, session(STUDENT_A));
    expect(res.status).toBe(200);
    expect(ops).toContain("update students");
  });

  it("refuses a new email without a proof", async () => {
    const res = await post({ ...profile, email: "new@example.com" }, session(STUDENT_A));
    expect(res.status).toBe(403);
    expect(ops).not.toContain("update students");
  });

  it("refuses a proof issued for a different email", async () => {
    const res = await post(
      {
        ...profile,
        email: "new@example.com",
        emailProof: proof("email_change", "other@example.com"),
      },
      session(STUDENT_A),
    );
    expect(res.status).toBe(403);
    expect(ops).not.toContain("update students");
  });

  it("refuses a signup proof for an email change", async () => {
    const res = await post(
      { ...profile, email: "new@example.com", emailProof: proof("signup", "new@example.com") },
      session(STUDENT_A),
    );
    expect(res.status).toBe(403);
    expect(ops).not.toContain("update students");
  });

  it("accepts a new email with a matching proof", async () => {
    const res = await post(
      {
        ...profile,
        email: "new@example.com",
        emailProof: proof("email_change", "new@example.com"),
      },
      session(STUDENT_A),
    );
    expect(res.status).toBe(200);
    expect(ops).toContain("update students");
  });
});

describe("createStudent", () => {
  const signup = { action: "createStudent", name: "Ada", grade: 9, schoolId: SCHOOL };

  it("refuses without a signup proof", async () => {
    const res = await post(signup);
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("refuses an email-change proof", async () => {
    const res = await post({ ...signup, proof: proof("email_change", "ada@example.com") });
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("refuses an expired proof", async () => {
    const res = await post({
      ...signup,
      proof: proof("signup", "ada@example.com", Date.now() - 1000),
    });
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("returns a session for a valid signup proof", async () => {
    const res = await post({ ...signup, proof: proof("signup", "ada@example.com") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token?: string };
    expect(typeof body.token).toBe("string");
  });
});
