import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getLimitsConfig } from "@/lib/limits";
import { logVisitorEvent } from "@/lib/analytics";
import { connectToDatabase } from "@/lib/mongoose";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkAndIncrementUsage, getOrCreateVisitor } from "@/lib/visitors";
import { Bot } from "@/models/Bot";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

const demoChatSchema = z.object({
  botSlug: z.string().trim().min(1),
  message: z.string().trim().min(1),
  visitorId: z.string().trim().min(1),
});

const DEMO_STUB_REPLY =
  "Demo stub reply from showcase bot. (Later: OpenAI + RAG here.)";

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = demoChatSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botSlug, message, visitorId } = parsed.data;

    const rateKey = `demo_chat:${visitorId}`;
    const rate = await checkRateLimit({
      key: rateKey,
      limit: 30,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Too many requests. Please wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    await connectToDatabase();

    const bot = await Bot.findOne({ slug: botSlug, type: "showcase" });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    await getOrCreateVisitor(visitorId);
    const limits = await getLimitsConfig();
    const usage = await checkAndIncrementUsage(visitorId, "showcase", limits);

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: `You reached the free limit of ${usage.limit} messages for showcase bots.`,
        },
        { status: 403 },
      );
    }

    const now = new Date();

    let conversation = await Conversation.findOne({
      botId: bot._id,
      visitorId,
    });
    let isNewConversation = false;

    if (!conversation) {
      conversation = await Conversation.create({
        botId: bot._id,
        visitorId,
        createdAt: now,
      });
      isNewConversation = true;
    }

    if (isNewConversation) {
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

    await Message.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: "user",
      content: message,
      createdAt: now,
    });

    await Message.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: "assistant",
      content: DEMO_STUB_REPLY,
      createdAt: new Date(),
    });

    return NextResponse.json({
      reply: DEMO_STUB_REPLY,
      usage: {
        allowed: true,
        current: usage.current,
        limit: usage.limit,
      },
    });
  } catch (error) {
    console.error("Demo chat request failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
