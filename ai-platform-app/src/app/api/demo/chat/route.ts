import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getMessageLimit } from "@/lib/limits";
import { logVisitorEvent } from "@/lib/analytics";
import { runChat } from "@/lib/chatEngine";
import { connectToDatabase } from "@/lib/mongoose";
import { checkRateLimit } from "@/lib/rateLimit";
import { getOrCreateVisitor } from "@/lib/visitors";
import { Bot } from "@/models/Bot";

const demoChatSchema = z.object({
  botSlug: z.string().trim().min(1),
  message: z.string().trim().min(1),
  visitorId: z.string().trim().min(1),
  userApiKey: z.string().trim().optional(),
  openaiApiKey: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
});

function formatUtcDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextUtcMidnightIso(date: Date): string {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
  return next.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = demoChatSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botSlug, message, visitorId, userApiKey, openaiApiKey, apiKey } = parsed.data;
    const requestApiKey =
      (typeof openaiApiKey === "string" && openaiApiKey.trim()) ||
      (typeof userApiKey === "string" && userApiKey.trim()) ||
      (typeof apiKey === "string" && apiKey.trim()) ||
      undefined;

    await connectToDatabase();

    const bot = await Bot.findOne({ slug: botSlug, type: "showcase" });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const visitor = await getOrCreateVisitor(visitorId);
    const hasUserApiKey = Boolean(
      requestApiKey,
    );
    const limit = getMessageLimit({
      bot: {
        type: bot.type,
        limitOverrideMessages: bot.limitOverrideMessages,
      },
      visitor: {
        limitOverrideMessages: visitor.limitOverrideMessages,
      },
      hasUserApiKey,
    });

    const now = new Date();
    const dayKey = formatUtcDayKey(now);
    const rateKey = `demo:msg:${visitorId}:${bot._id.toString()}:${dayKey}`;
    const rate = await checkRateLimit({
      key: rateKey,
      limit,
      windowMs: 24 * 60 * 60 * 1000,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limited",
          limit,
          resetAt: getNextUtcMidnightIso(now),
        },
        { status: 429 },
      );
    }

    const chatResult = await runChat({
      bot: {
        _id: bot._id,
        openaiApiKeyOverride: bot.openaiApiKeyOverride,
        personality: bot.personality,
        config: bot.config,
        faqs: bot.faqs,
      },
      visitorId,
      message,
      mode: "demo",
      userApiKey: requestApiKey,
    });

    if (!chatResult.ok) {
      return NextResponse.json(chatResult, { status: 400 });
    }

    if (chatResult.isNewConversation) {
      await logVisitorEvent({
        visitorId,
        type: "demo_chat_started",
        botSlug: bot.slug,
        botId: bot._id.toString(),
        metadata: {
          source: "demo_chat_api",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      conversationId: chatResult.conversationId,
      assistantMessage: chatResult.assistantMessage,
      sources: chatResult.sources,
    });
  } catch (error) {
    console.error("Demo chat request failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
