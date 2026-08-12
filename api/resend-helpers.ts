// Shared Resend helpers for Vercel API routes under api/.
// On send failure: queue a skip row (soft-fail if table missing).
// On send success: flush pending skips as one digest to the admin address.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";

export const FROM_ADDRESS = "Student Atlas <noreply@emptyconsole.com>";
export const ADMIN_SKIP_NOTIFY_TO = "consoleempty@gmail.com";

export type SkippedEmailKind =
  | "otp_signup"
  | "otp_login"
  | "otp_email_change"
  | "rankings";

type SendOrSkipArgs = {
  resend: Resend;
  /** Service-role client — required for skipped_emails access. */
  supabase: SupabaseClient;
  to: string;
  subject: string;
  html: string;
  kind: SkippedEmailKind;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resendErrorDetail(error: unknown): string {
  if (error == null) return "Unknown Resend error";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; name?: string; statusCode?: number };
    const parts = [e.name, e.message, e.statusCode != null ? `status ${e.statusCode}` : null]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(": ");
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function queueSkippedEmail(
  supabase: SupabaseClient,
  kind: SkippedEmailKind,
  intendedTo: string,
  detail: string,
): Promise<void> {
  const { error } = await supabase.from("skipped_emails").insert({
    kind,
    intended_to: intendedTo,
    detail,
  });
  if (error) {
    // Soft-fail: table may not exist yet; never block the user flow.
    console.error("Failed to queue skipped_emails row:", error);
  }
}

function buildSkipDigestHtml(
  rows: {
    kind: string;
    intended_to: string;
    detail: string | null;
    created_at: string;
  }[],
): string {
  const items = rows
    .map((row) => {
      const when = escapeHtml(row.created_at);
      const kind = escapeHtml(row.kind);
      const to = escapeHtml(row.intended_to);
      const detail = escapeHtml(row.detail ?? "");
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;vertical-align:top;">${when}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;vertical-align:top;">${kind}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;vertical-align:top;">${to}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;vertical-align:top;">${detail}</td>
        </tr>`;
    })
    .join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#faf9f6;">
      <div style="background:#ffffff;border:1px solid #d7e3fc;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 8px;font-size:20px;color:#1f2937;">Email(s) had to be skipped</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
          Resend could not deliver ${rows.length} email(s). They were skipped so users were not blocked.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #d7e3fc;">When</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #d7e3fc;">Kind</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #d7e3fc;">Intended to</th>
              <th style="text-align:left;padding:8px 12px;font-size:12px;color:#9ca3af;border-bottom:1px solid #d7e3fc;">Detail</th>
            </tr>
          </thead>
          <tbody>
            ${items}
          </tbody>
        </table>
      </div>
    </div>`;
}

/**
 * Send pending skip notices to the admin. Soft-fails if the table is missing
 * or Resend still rejects the digest.
 */
export async function flushSkippedEmailNotices(
  supabase: SupabaseClient,
  resend: Resend,
): Promise<void> {
  const { data, error } = await supabase
    .from("skipped_emails")
    .select("id, kind, intended_to, detail, created_at")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("Failed to load skipped_emails for flush:", error);
    return;
  }
  if (!data || data.length === 0) return;

  const { error: sendError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: ADMIN_SKIP_NOTIFY_TO,
    subject:
      data.length === 1
        ? "Student Atlas: an email had to be skipped"
        : `Student Atlas: ${data.length} emails had to be skipped`,
    html: buildSkipDigestHtml(data),
  });

  if (sendError) {
    console.error("Failed to send skipped-email digest:", sendError);
    return;
  }

  const ids = data.map((row) => row.id as string);
  const { error: updateError } = await supabase
    .from("skipped_emails")
    .update({ notified_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    console.error("Failed to mark skipped_emails as notified:", updateError);
  }
}

/**
 * Attempt Resend send. On failure, queue a skip and return `{ skipped: true }`.
 * On success, flush any pending admin notices and return `{ skipped: false }`.
 */
export async function sendOrSkip(args: SendOrSkipArgs): Promise<{ skipped: boolean }> {
  const { resend, supabase, to, subject, html, kind } = args;

  const { error: sendError } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (sendError) {
    console.error("Resend error:", sendError);
    await queueSkippedEmail(supabase, kind, to, resendErrorDetail(sendError));
    return { skipped: true };
  }

  await flushSkippedEmailNotices(supabase, resend);
  return { skipped: false };
}
