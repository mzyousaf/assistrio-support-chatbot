import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";

export const runtime = "nodejs";

const MAX = { name: 120, email: 254 } as const;

function emailOk(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * POST JSON: { platformVisitorId, name, email, cta: { label, location, href, sourcePath, showcaseSlug?, showcaseBotId? } }
 *
 * Proxies to Nest `POST /api/landing/trial/request-access` via {@link assistrioBackendFetchSafe}. The API issues the token and sends email.
 *
 * Env: `NEXT_LANDING_SITE_X_API_KEY` (or `NEXT_ASSISTRIO_LANDING_SITE_X_API_KEY`), `NEXT_PUBLIC_API_BASE_URL`
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", errorCode: "BAD_REQUEST" }, { status: 400 });
  }

  if (body == null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload.", errorCode: "BAD_REQUEST" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const platformVisitorId = typeof o.platformVisitorId === "string" ? o.platformVisitorId.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";

  if (!platformVisitorId || platformVisitorId.length < 6) {
    return NextResponse.json(
      { error: "A valid browser session is required.", errorCode: "INVALID_PLATFORM_VISITOR_ID" },
      { status: 400 },
    );
  }
  if (!name || name.length > MAX.name) {
    return NextResponse.json({ error: "Please enter your name.", errorCode: "INVALID_NAME" }, { status: 400 });
  }
  if (!email || email.length > MAX.email || !emailOk(email)) {
    return NextResponse.json({ error: "Please enter a valid email address.", errorCode: "INVALID_EMAIL" }, { status: 400 });
  }

  const ctaRaw = o.cta;
  if (ctaRaw == null || typeof ctaRaw !== "object" || Array.isArray(ctaRaw)) {
    return NextResponse.json({ error: "Missing CTA context.", errorCode: "BAD_REQUEST" }, { status: 400 });
  }
  const c = ctaRaw as Record<string, unknown>;
  const cta = {
    label: typeof c.label === "string" ? c.label.trim().slice(0, 200) : "",
    location: typeof c.location === "string" ? c.location.trim().slice(0, 120) : "",
    href: typeof c.href === "string" ? c.href.trim().slice(0, 500) : "",
    sourcePath: typeof c.sourcePath === "string" ? c.sourcePath.trim().slice(0, 500) : "",
    showcaseSlug:
      c.showcaseSlug === null || c.showcaseSlug === undefined
        ? null
        : typeof c.showcaseSlug === "string"
          ? c.showcaseSlug.trim().slice(0, 200) || null
          : null,
    showcaseBotId:
      c.showcaseBotId === null || c.showcaseBotId === undefined
        ? null
        : typeof c.showcaseBotId === "string"
          ? c.showcaseBotId.trim().slice(0, 40) || null
          : null,
  };

  try {
    const backendRes = await assistrioBackendFetchSafe("/api/landing/trial/request-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platformVisitorId,
        name,
        email,
        cta,
      }),
    });
    if (!backendRes) {
      console.error("[trial/request-access] Missing NEXT_PUBLIC_API_BASE_URL or landing X-API-Key");
      return NextResponse.json(
        {
          error: "Trial access is not configured on the server.",
          errorCode: "NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    const backendJson = (await backendRes.json().catch(() => ({}))) as {
      ok?: boolean;
      emailId?: string;
      error?: string;
      errorCode?: string;
      retryAfterSeconds?: number;
    };

    if (!backendRes.ok) {
      const status = backendRes.status >= 400 && backendRes.status < 600 ? backendRes.status : 502;
      return NextResponse.json(
        {
          error: backendJson.error ?? "Could not complete your request.",
          errorCode: backendJson.errorCode ?? "BACKEND_ERROR",
          retryAfterSeconds: backendJson.retryAfterSeconds,
        },
        { status },
      );
    }

    if (!backendJson.ok || typeof backendJson.emailId !== "string" || !backendJson.emailId.trim()) {
      return NextResponse.json(
        { error: "Unexpected response from server.", errorCode: "BACKEND_ERROR" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, emailId: backendJson.emailId.trim() }, { status: 200 });
  } catch (e) {
    console.error("[trial/request-access] Backend fetch failed:", e);
    return NextResponse.json(
      { error: "Could not reach the server. Try again shortly.", errorCode: "NETWORK_ERROR" },
      { status: 502 },
    );
  }
}
