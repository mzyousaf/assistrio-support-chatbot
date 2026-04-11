import { proxyJsonPostToNest } from "@/lib/server/proxy-json-to-nest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return proxyJsonPostToNest("/api/public/visitor-bot/basic-insights", request);
}
