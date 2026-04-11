import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";

const MAX = { name: 120, email: 254, subject: 200, message: 12_000 } as const;

/**
 * POST JSON: { name, email, message, subject?, website? }
 * `website` is a honeypot — must be empty.
 *
 * Proxies to Nest `POST /api/landing/contact` via {@link assistrioBackendFetchSafe} (`X-API-Key`). Email is sent by the API.
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

  try {
    const backendRes = await assistrioBackendFetchSafe("/api/landing/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        message,
        subject: subject.slice(0, MAX.subject),
      }),
    });
    if (!backendRes) {
      console.error("[contact] Missing NEXT_PUBLIC_API_BASE_URL or landing X-API-Key");
      return NextResponse.json(
        { error: "Contact form is not configured on the server." },
        { status: 503 },
      );
    }

    const backendJson = (await backendRes.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      error?: string;
      errorCode?: string;
      retryAfterSeconds?: number;
    };

    if (!backendRes.ok) {
      const status = backendRes.status >= 400 && backendRes.status < 600 ? backendRes.status : 502;
      if (backendJson.errorCode === "EMAIL_NOT_CONFIGURED" || status === 503) {
        return NextResponse.json(
          {
            error:
              backendJson.error ??
              "Contact delivery is not configured yet. Email support@assistrio.com directly.",
          },
          { status: 503 },
        );
      }
      if (backendJson.errorCode === "RATE_LIMITED") {
        return NextResponse.json(
          {
            error: backendJson.error ?? "Too many requests. Try again later.",
            retryAfterSeconds: backendJson.retryAfterSeconds,
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        {
          error:
            backendJson.error ??
            "Could not send your message. Please try again or email support@assistrio.com.",
        },
        { status: status === 503 ? 503 : 502 },
      );
    }

    if (!backendJson.ok || typeof backendJson.id !== "string" || !backendJson.id.trim()) {
      return NextResponse.json({ error: "Unexpected response from server." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id: backendJson.id.trim() }, { status: 200 });
  } catch (e) {
    console.error("[contact] Backend fetch failed:", e);
    return NextResponse.json(
      { error: "Could not reach the server. Try again shortly." },
      { status: 502 },
    );
  }
}
