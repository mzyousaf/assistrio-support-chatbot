import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * Same-origin proxy: Nest `GET /api/public/bots/:slug` via {@link assistrioBackendFetchSafe}.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const encoded = encodeURIComponent(slug);

  const res = await assistrioBackendFetchSafe(`/api/public/bots/${encoded}`, {
    next: { revalidate: 60 },
    headers: { Accept: "application/json" },
  });
  if (!res) {
    console.error("[api/public/bots/[slug]] Missing NEXT_PUBLIC_API_BASE_URL or landing X-API-Key");
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }
  try {
    const body = await res.text();
    const ct = res.headers.get("content-type") ?? "application/json";
    return new NextResponse(body, { status: res.status, headers: { "Content-Type": ct } });
  } catch (e) {
    console.error("[api/public/bots/[slug]] Upstream read failed:", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
