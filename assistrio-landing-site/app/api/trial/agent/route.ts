import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { assistrioBackendFetchSafe, isAssistrioBackendConfigError } from "@/lib/server/assistrio-backend";
import { TRIAL_SESSION_COOKIE_NAME } from "@/lib/trial/trial-session-cookie";

export const runtime = "nodejs";

const TRIAL_SESSION_HEADER = "x-trial-dashboard-session-token";

export async function GET() {
  const raw = (await cookies()).get(TRIAL_SESSION_COOKIE_NAME)?.value?.trim();
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized", errorCode: "SESSION_INVALID" }, { status: 401 });
  }

  try {
    const res = await assistrioBackendFetchSafe("/api/landing/trial/agent", {
      method: "GET",
      headers: { Accept: "application/json", [TRIAL_SESSION_HEADER]: raw },
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
    console.error("[trial agent GET proxy]", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
