import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe } from "@/lib/server/assistrio-backend";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string; documentId: string }> };

/**
 * Same-origin proxy: Nest document download (`X-API-Key` via {@link assistrioBackendFetchSafe}).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug, documentId } = await params;
  const path = `/api/public/bots/${encodeURIComponent(slug)}/documents/${encodeURIComponent(documentId)}/download`;

  const res = await assistrioBackendFetchSafe(path, {
    redirect: "manual",
    cache: "no-store",
  });
  if (!res) {
    console.error("[api/public/bots/.../download] Missing NEXT_PUBLIC_API_BASE_URL or landing X-API-Key");
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  try {
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        return NextResponse.redirect(loc, res.status === 307 ? 307 : 302);
      }
    }

    const body = await res.text().catch(() => "");
    const ct = res.headers.get("content-type") ?? "application/json";
    return new NextResponse(body, { status: res.status, headers: { "Content-Type": ct } });
  } catch (e) {
    console.error("[api/public/bots/.../download] Upstream failed:", e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
