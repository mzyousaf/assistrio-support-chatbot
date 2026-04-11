import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { assistrioBackendFetchSafe, isAssistrioBackendConfigError } from "@/lib/server/assistrio-backend";
import { TRIAL_SESSION_COOKIE_NAME } from "@/lib/trial/trial-session-cookie";

export const runtime = "nodejs";

const TRIAL_SESSION_HEADER = "x-trial-dashboard-session-token";

export async function PATCH(request: Request) {
  const raw = (await cookies()).get(TRIAL_SESSION_COOKIE_NAME)?.value?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized", errorCode: "SESSION_INVALID" }, { status: 401 });
  }

  let bodyText = "{}";
  try {
    bodyText = await request.text();
  } catch {
    bodyText = "{}";
  }

  try {
    const res = await assistrioBackendFetchSafe("/api/landing/trial/agent/profile", {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        [TRIAL_SESSION_HEADER]: raw,
      },
      body: bodyText || "{}",
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
    console.error("[trial agent profile PATCH proxy]", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
