import { NextResponse } from "next/server";

import { sendContactEmailToSupport } from "@/lib/email/send-contact-email-to-support";

const MAX = { name: 120, email: 254, subject: 200, message: 12_000 } as const;

/**
 * POST JSON: { name, email, message, subject?, website? }
 * `website` is a honeypot — must be empty.
 *
 * Uses `sendContactEmailToSupport` (Resend SDK). Configure `RESEND_API_KEY` and optional `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL`.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const honeypot = typeof o.website === "string" ? o.website.trim() : "";
  if (honeypot.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const subjectRaw = typeof o.subject === "string" ? o.subject.trim() : "";

  if (!name || name.length > MAX.name) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!email || email.length > MAX.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length > MAX.message) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  const subject =
    subjectRaw.length > 0
      ? subjectRaw.slice(0, MAX.subject)
      : `Contact form: ${name.slice(0, 40)}${name.length > 40 ? "…" : ""}`;

  const result = await sendContactEmailToSupport({
    name,
    email,
    message,
    subject: subject.slice(0, MAX.subject),
  });

  if (!result.ok) {
    if (result.reason === "missing_api_key") {
      console.warn("[contact]", result.message);
      return NextResponse.json(
        {
          error:
            "Contact delivery is not configured yet. Email support@assistrio.com directly, or set RESEND_API_KEY in the server environment.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Could not send your message. Please try again or email support@assistrio.com." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
