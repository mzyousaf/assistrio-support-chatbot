import { NextResponse } from "next/server";

import { validateTrialDashboardSession } from "@/lib/server/trial-session";

export const runtime = "nodejs";

/**
 * Lightweight same-origin check: trial session cookie valid (Nest validate via `X-API-Key`).
 * Used to avoid false "link already used" after a successful verify race.
 */
export async function GET() {
  const session = await validateTrialDashboardSession();
  if (!session) {
    return NextResponse.json({ ok: false as const }, { status: 401 });
  }
  return NextResponse.json({ ok: true as const });
}
