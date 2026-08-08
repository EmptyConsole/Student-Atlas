import { createHmac } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-teacher-session-secret";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.TEACHER_SESSION_SECRET = SECRET;

/** Every table operation the handler performed, in order. */
const ops = vi.hoisted(() => [] as string[]);
const rpcCalls = vi.hoisted(() => [] as string[]);

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => tableBuilder(table),
    rpc: async (name: string) => {
      rpcCalls.push(name);
      return { data: true, error: null };
    },
  }),
}));

/**
 * Minimal stand-in for a PostgREST query builder: chainable, thenable, and it
 * records `<verb> <table>` when a query is finally awaited.
 */
function tableBuilder(table: string) {
  let verb = "select";
  const finish = (single: boolean) => {
    ops.push(`${verb} ${table}`);
    return Promise.resolve({ data: rowsFor(table, verb, single), error: null });
  };

  const builder = {
    select: () => ((verb = "select"), builder),
    delete: () => ((verb = "delete"), builder),
    update: () => ((verb = "update"), builder),
    insert: () => ((verb = "insert"), builder),
    eq: () => builder,
    in: () => builder,
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
  if (verb !== "select") return null;
  if (single) return { id: `${table}-1`, name: "Existing" };
  if (table === "courses") return [{ id: "course-1" }];
  return [];
}

function signToken(schoolId: string, expiresAt = Date.now() + 60_000): string {
  const body = Buffer.from(JSON.stringify({ sid: schoolId, exp: expiresAt }))
    .toString("base64url");
  const signature = createHmac("sha256", SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function post(body: unknown, token?: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/teacher-mutate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

const { POST } = await import("./teacher-mutate");

describe("teacher-mutate auth", () => {
  beforeEach(() => {
    ops.length = 0;
    rpcCalls.length = 0;
  });

  it("rejects a request with no token", async () => {
    const res = await post({ action: "deleteCourse", courseId: "course-1" });
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects a token whose signature does not match", async () => {
    const [body] = signToken("school-1").split(".");
    const res = await post({ action: "deleteCourse" }, `${body}.forged`);
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });

  it("rejects an expired token", async () => {
    const res = await post(
      { action: "deleteCourse", courseId: "course-1" },
      signToken("school-1", Date.now() - 1000),
    );
    expect(res.status).toBe(401);
    expect(ops).toHaveLength(0);
  });
});

describe("deleteDepartment", () => {
  beforeEach(() => {
    ops.length = 0;
    rpcCalls.length = 0;
  });

  it("re-checks the password and deletes courses before the department", async () => {
    const res = await post(
      {
        action: "deleteDepartment",
        departmentId: "dept-1",
        password: "hunter2",
      },
      signToken("school-1"),
    );

    expect(res.status).toBe(200);
    expect(rpcCalls).toContain("verify_school_password");

    const deletes = ops.filter((op) => op.startsWith("delete "));
    expect(deletes.at(-1)).toBe("delete departments");
    expect(deletes.indexOf("delete courses")).toBeLessThan(
      deletes.indexOf("delete departments"),
    );
    // Child rows are cleared before the courses that own them.
    expect(deletes.indexOf("delete completed_courses")).toBeLessThan(
      deletes.indexOf("delete courses"),
    );
  });
});
