import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";

export const runtime = "nodejs";

/**
 * Same-origin proxy: Nest `GET /api/public/bots` via {@link assistrioBackendFetchSafe}.
 */
export async function GET() {
  const res = await assistrioBackendFetchSafe("/api/public/bots", {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!res) {
    console.error("[api/public/bots] Missing NEXT_PUBLIC_API_BASE_URL or landing X-API-Key");
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }
  try {
    const body = await res.text();
    const ct = res.headers.get("content-type") ?? "application/json";
    return new NextResponse(body, { status: res.status, headers: { "Content-Type": ct } });
  } catch (e) {
    console.error("[api/public/bots] Upstream read failed:", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
