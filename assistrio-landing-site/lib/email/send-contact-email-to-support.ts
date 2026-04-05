import "server-only";

import { Resend } from "resend";

export type SendContactToSupportInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContactHtml(input: SendContactToSupportInput) {
  return `
    <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
    <p><strong>Message:</strong></p>
    <pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(input.message)}</pre>
  `.trim();
}

export type SendContactToSupportResult =
  | { ok: true; id: string }
  | { ok: false; reason: "missing_api_key"; message: string }
  | { ok: false; reason: "resend_error"; message: string };

/**
 * Sends the marketing contact form payload to the support inbox via Resend.
 *
 * Env:
 * - `RESEND_API_KEY` (required)
 * - `CONTACT_FROM_EMAIL` — default `Assistrio <onboarding@resend.dev>` (use a verified domain in production)
 * - `CONTACT_TO_EMAIL` — default `support@assistrio.com`
 */
export async function sendContactEmailToSupport(input: SendContactToSupportInput): Promise<SendContactToSupportResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "missing_api_key",
      message: "RESEND_API_KEY is not configured.",
    };
  }

  const from = process.env.CONTACT_FROM_EMAIL ?? "Assistrio <onboarding@resend.dev>";
  const to = process.env.CONTACT_TO_EMAIL ?? "support@assistrio.com";

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: input.email,
    subject: input.subject,
    html: buildContactHtml(input),
  });

  if (error) {
    console.error("[sendContactEmailToSupport] Resend error:", error);
    return {
      ok: false,
      reason: "resend_error",
      message: error.message ?? "Resend rejected the send.",
    };
  }

  if (!data?.id) {
    return {
      ok: false,
      reason: "resend_error",
      message: "No email id returned from Resend.",
    };
  }

  return { ok: true, id: data.id };
}
