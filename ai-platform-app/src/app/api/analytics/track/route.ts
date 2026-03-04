import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildCorsHeaders, isAllowedCorsOrigin } from "@/lib/cors";
import { connectToDatabase } from "@/lib/mongoose";
import { getOrCreateVisitor } from "@/lib/visitors";
import { VisitorEvent, type VisitorEventType } from "@/models/VisitorEvent";

const visitorEventTypes: readonly VisitorEventType[] = [
  "page_view",
  "demo_chat_started",
  "trial_bot_created",
  "trial_chat_started",
] as const;

const trackAnalyticsSchema = z.object({
  visitorId: z.string().trim().min(1),
  type: z.enum(visitorEventTypes),
  path: z.string().optional(),
  botSlug: z.string().optional(),
  botId: z
    .string()
    .optional()
    .refine(
      (value) => value === undefined || mongoose.Types.ObjectId.isValid(value),
      { message: "Invalid botId" },
    ),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!isAllowedCorsOrigin(origin)) {
    return new NextResponse(null, { status: 403, headers: { Vary: "Origin" } });
  }

  return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isCorsRequest = Boolean(origin);

  if (isCorsRequest && !isAllowedCorsOrigin(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers: { Vary: "Origin" } });
  }

  const headers = isAllowedCorsOrigin(origin) ? buildCorsHeaders(origin) : undefined;

  try {
    const json = (await request.json()) as unknown;
    const parsed = trackAnalyticsSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400, headers });
    }

    const { visitorId, type, path, botSlug, botId, metadata } = parsed.data;

    await connectToDatabase();
    await getOrCreateVisitor(visitorId);

    const eventPayload = {
      visitorId,
      type,
      path,
      botSlug,
      botId: botId ? new mongoose.Types.ObjectId(botId) : undefined,
      metadata,
      createdAt: new Date(),
    };

    await VisitorEvent.create(eventPayload);

    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error("Analytics tracking failed:", error);
    return NextResponse.json({ error: "Failed to track event" }, { status: 500, headers });
  }
}
