import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";
import {
  TRIAL_SESSION_COOKIE_NAME,
  TRIAL_SESSION_COOKIE_PATH,
} from "@/lib/trial/trial-session-cookie";

export const runtime = "nodejs";

function readNestErrorCode(body: unknown): string {
  if (body == null || typeof body !== "object") return "UNKNOWN";
  const o = body as Record<string, unknown>;
  if (typeof o.errorCode === "string") return o.errorCode;
  const msg = o.message;
  if (msg != null && typeof msg === "object" && !Array.isArray(msg)) {
    const inner = (msg as Record<string, unknown>).errorCode;
    if (typeof inner === "string") return inner;
  }
  return "UNKNOWN";
}

async function readTokenFromPost(request: Request): Promise<string> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await request.json()) as unknown;
      if (body != null && typeof body === "object" && !Array.isArray(body)) {
        const t = (body as Record<string, unknown>).token;
        if (typeof t === "string") return t.trim();
      }
    } catch {
      return "";
    }
    return "";
  }
  const fd = await request.formData();
  return String(fd.get("token") ?? "").trim();
}

type VerifyFailureReason = "missing" | "invalid" | "expired" | "used" | "config" | "error";

function jsonVerifyFailure(reason: VerifyFailureReason, status: number) {
  return NextResponse.json({ ok: false as const, reason }, { status });
}

const TRIAL_DASHBOARD_PATH = "/trial/dashboard";

/**
 * POST only — verifies magic link via Nest (`X-API-Key`), sets httpOnly trial session cookie.
 * Success returns **200 JSON** `{ ok: true, redirectTo }` so the client does not depend on interpreting redirect responses.
 * Failures return JSON `{ ok: false, reason }`.
 * GET is not supported so email scanners prefetching URLs cannot consume one-time tokens.
 */
export async function POST(request: Request) {
  const token = await readTokenFromPost(request);
  if (!token) {
    return jsonVerifyFailure("missing", 400);
  }

  const backendRes = await assistrioBackendFetchSafe("/api/landing/trial/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!backendRes) {
    return jsonVerifyFailure("config", 503);
  }

  const json = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;

  if (!backendRes.ok) {
    const code = readNestErrorCode(json);
    const reasonMap: Record<string, VerifyFailureReason> = {
      TOKEN_INVALID: "invalid",
      TOKEN_EXPIRED: "expired",
      TOKEN_USED: "used",
      BAD_REQUEST: "invalid",
    };
    const reason: VerifyFailureReason = reasonMap[code] ?? "error";
    const status =
      code === "TOKEN_USED"
        ? 409
        : code === "TOKEN_EXPIRED"
          ? 410
          : backendRes.status >= 400 && backendRes.status < 600
            ? backendRes.status
            : 400;
    return jsonVerifyFailure(reason, status);
  }

  const sessionToken = typeof json.sessionToken === "string" ? json.sessionToken.trim() : "";
  const maxAgeSeconds =
    typeof json.maxAgeSeconds === "number" && Number.isFinite(json.maxAgeSeconds) && json.maxAgeSeconds > 0
      ? Math.floor(json.maxAgeSeconds)
      : 14 * 24 * 3600;

  if (!json.ok || !sessionToken) {
    return jsonVerifyFailure("error", 502);
  }

  const res = NextResponse.json(
    { ok: true as const, redirectTo: TRIAL_DASHBOARD_PATH },
    { status: 200 },
  );
  res.cookies.set(TRIAL_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: TRIAL_SESSION_COOKIE_PATH,
    maxAge: maxAgeSeconds,
  });
  return res;
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
