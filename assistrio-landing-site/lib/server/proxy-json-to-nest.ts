import { NextResponse } from "next/server";

import { assistrioBackendFetchSafe, isAssistrioBackendConfigError } from "@/lib/server/assistrio-backend";

/**
 * Forwards the incoming POST body to Nest `path` using {@link assistrioBackendFetchSafe} (`X-API-Key` + `NEXT_PUBLIC_API_BASE_URL`).
 */
export async function proxyJsonPostToNest(path: string, request: Request): Promise<NextResponse> {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  try {
    const res = await assistrioBackendFetchSafe(path, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
      },
      body,
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
    console.error(`[proxy ${path}]`, e);
    return NextResponse.json({ error: "Could not reach the API." }, { status: 502 });
  }
}
