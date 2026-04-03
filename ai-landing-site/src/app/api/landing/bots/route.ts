import { NextResponse } from "next/server";
import { normalizePublicBotsPayload } from "@/lib/normalize-public-bots";

/**
 * Proxies public bot lists so the browser can call same-origin `/api/landing/bots`
 * (visible in DevTools Network). Keeps `LANDING_SITE_BOTS_API_KEY` on the server only.
 */
export async function GET() {
  const apiBase =
    typeof process.env.NEXT_PUBLIC_API_BASE_URL === "string"
      ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/$/, "")
      : "";
  const landingKey =
    typeof process.env.LANDING_SITE_BOTS_API_KEY === "string"
      ? process.env.LANDING_SITE_BOTS_API_KEY.trim()
      : "";

  if (!apiBase) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_API_BASE_URL is not set", bots: [] as unknown[] },
      { status: 503 },
    );
  }

  try {
    let res: Response;

    if (landingKey) {
      res = await fetch(`${apiBase}/api/public/landing/bots`, {
        cache: "no-store",
        headers: { "X-API-Key": landingKey },
      });
    } else {
      /** Dev fallback: no key — same public gallery as `GET /api/public/bots`. */
      res = await fetch(`${apiBase}/api/public/bots`, { cache: "no-store" });
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Upstream ${res.status}`,
          detail: text.slice(0, 200),
          bots: [],
        },
        { status: res.status },
      );
    }

    const payload: unknown = await res.json();
    const bots = normalizePublicBotsPayload(payload);
    return NextResponse.json(bots);
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message, bots: [] }, { status: 502 });
  }
}
