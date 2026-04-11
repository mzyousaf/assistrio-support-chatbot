import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { assistrioBackendFetchSafe, isAssistrioBackendConfigError } from "@/lib/server/assistrio-backend";
import { TRIAL_SESSION_COOKIE_NAME } from "@/lib/trial/trial-session-cookie";

export const runtime = "nodejs";

/** Opaque dashboard session — forwarded to Nest only (never sent to the browser in this header). */
const TRIAL_SESSION_HEADER = "x-trial-dashboard-session-token";

async function forwardWithSession(method: "GET" | "PATCH", request?: Request): Promise<NextResponse> {
  const raw = (await cookies()).get(TRIAL_SESSION_COOKIE_NAME)?.value?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized", errorCode: "SESSION_INVALID" }, { status: 401 });
  }

  let body: string | undefined;
  if (method === "PATCH") {
    if (!request) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    try {
      body = await request.text();
    } catch {
      return NextResponse.json({ error: "Invalid body." }, { status: 400 });
    }
  }

  try {
    const res = await assistrioBackendFetchSafe("/api/landing/trial/draft", {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "PATCH" && request
          ? { "Content-Type": request.headers.get("content-type") ?? "application/json" }
          : {}),
        [TRIAL_SESSION_HEADER]: raw,
      },
      ...(body !== undefined ? { body } : {}),
    });
    if (!res) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
    }
    const text = await res.text();
    const ct = res.headers.get("content-type") ?? "application/json";
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": ct } });
  } catch (e) {
    if (isAssistrioBackendConfigError(e)) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
    }
    console.error("[trial draft proxy]", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}

export async function GET() {
  return forwardWithSession("GET");
}

export async function PATCH(request: Request) {
  return forwardWithSession("PATCH", request);
}
