// Vercel serverless function: emails a student a copy of their submitted
// elective rankings via Resend. Invoked from the app right after a successful
// final submit on the Register page.
//
// The recipient address is always looked up server-side from the `students`
// table (never taken from the request body), so this endpoint can only send
// mail to addresses that belong to registered students.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const FROM_ADDRESS = "Student Atlas <noreply@emptyconsole.com>";

type Payload = {
  studentId: string;
  /** One entry per term column, in display order, course ids ranked 1..N. */
  columns: { termName: string; courseIds: string[] }[];
  note?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailHtml(
  studentName: string,
  columns: { termName: string; titles: string[] }[],
  note: string | null,
): string {
  const termSections = columns
    .map((col) => {
      const items = col.titles
        .map(
          (title, i) => `
            <tr>
              <td style="padding:6px 12px 6px 0;color:#4169e1;font-weight:700;white-space:nowrap;vertical-align:top;">${i + 1}.</td>
              <td style="padding:6px 0;color:#374151;">${escapeHtml(title)}</td>
            </tr>`,
        )
        .join("");
      return `
        <div style="margin-top:24px;">
          <h2 style="margin:0 0 8px;font-size:16px;color:#1f2937;">${escapeHtml(col.termName)}</h2>
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
            ${items}
          </table>
        </div>`;
    })
    .join("");

  const noteSection = note
    ? `
      <div style="margin-top:24px;padding:12px 16px;background:#fffff0;border:1px solid #f3e5ab;border-radius:8px;">
        <h2 style="margin:0 0 6px;font-size:14px;color:#1f2937;">Your appeals / notes</h2>
        <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(note)}</p>
      </div>`
    : "";

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#faf9f6;">
      <div style="background:#ffffff;border:1px solid #d7e3fc;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 4px;font-size:20px;color:#1f2937;">Elective rankings submitted</h1>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">
          Hi ${escapeHtml(studentName)}, here's a copy of the course rankings you submitted.
        </p>
        ${termSections}
        ${noteSection}
        <p style="margin:28px 0 0;font-size:12px;color:#9ca3af;">
          This is an automated confirmation from Student Atlas. If anything looks wrong, please contact your school.
        </p>
      </div>
    </div>`;
}

export async function POST(request: Request): Promise<Response> {
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const resendApiKey = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!resendApiKey || !supabaseUrl || !supabaseKey) {
    return json({ error: "Server is missing required environment variables" }, 500);
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { studentId, columns, note } = payload;
  if (!studentId || !Array.isArray(columns) || columns.length === 0) {
    return json({ error: "studentId and columns are required" }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("name, email")
    .eq("id", studentId)
    .single();

  if (studentError || !student?.email) {
    return json({ error: "Student not found or has no email" }, 404);
  }

  const allCourseIds = [
    ...new Set(columns.flatMap((col) => col.courseIds ?? [])),
  ];
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select("id, title")
    .in("id", allCourseIds);

  if (coursesError) {
    return json({ error: "Failed to load courses" }, 500);
  }

  const titleById = new Map<string, string>(
    (courses ?? []).map((c) => [c.id as string, c.title as string]),
  );
  const hydratedColumns = columns.map((col) => ({
    termName: col.termName ?? "Term",
    titles: (col.courseIds ?? [])
      .map((id) => titleById.get(id))
      .filter((t): t is string => Boolean(t)),
  }));

  const html = buildEmailHtml(
    (student.name as string) ?? "there",
    hydratedColumns,
    note?.trim() || null,
  );

  const resend = new Resend(resendApiKey);
  const { error: sendError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: student.email as string,
    subject: "Your elective rankings have been submitted",
    html,
  });

  if (sendError) {
    console.error("Resend error:", sendError);
    return json({ error: "Failed to send email" }, 502);
  }

  return json({ ok: true }, 200);
}
