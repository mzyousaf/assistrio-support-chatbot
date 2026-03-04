import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import { getLimitsConfig } from "@/lib/limits";
import { logVisitorEvent } from "@/lib/analytics";
import { connectToDatabase } from "@/lib/mongoose";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRelevantChunksForBot } from "@/lib/rag";
import { checkAndIncrementUsage, getOrCreateVisitor } from "@/lib/visitors";
import { Bot } from "@/models/Bot";
import { Conversation } from "@/models/Conversation";
import { Message } from "@/models/Message";

const trialChatSchema = z.object({
  botSlug: z.string().trim().min(1),
  message: z.string().trim().min(1),
  visitorId: z.string().trim().min(1),
});

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as unknown;
    const parsed = trialChatSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { botSlug, message, visitorId } = parsed.data;

    const rateKey = `trial_chat:${visitorId}`;
    const rate = await checkRateLimit({
      key: rateKey,
      limit: 60,
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

    const bot = await Bot.findOne({ slug: botSlug, type: "visitor-own" });
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    const personality = bot.personality ?? {};
    const cfg = bot.config ?? {};

    const tone = personality.tone ?? "friendly";
    const language = personality.language ?? "en";
    const systemPromptOverride = personality.systemPrompt;

    const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.2;
    const maxTokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 512;
    const responseLength = cfg.responseLength ?? "medium";

    await getOrCreateVisitor(visitorId);
    const limits = await getLimitsConfig();
    const usage = await checkAndIncrementUsage(visitorId, "visitor-own", limits);

    if (!usage.allowed) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: `You reached the free limit of ${usage.limit} messages for your own bot.`,
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
        type: "trial_chat_started",
        botSlug: bot.slug,
        botId: bot._id.toString(),
        metadata: {
          source: "trial_chat_api",
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

    let replyText =
      "I don't know based on the provided context. Please add more documents.";
    try {
      const openai = getOpenAIClient();
      const contextChunks = await getRelevantChunksForBot(bot._id.toString(), message, 4);
      const contextText = contextChunks
        .map((c, idx) => `# Snippet ${idx + 1}\n${c.text}`)
        .join("\n\n");

      const faqs = bot.faqs ?? [];
      const faqsText =
        faqs.length > 0
          ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
          : "";

      let systemPrompt =
        "You are an AI assistant for a trial chatbot. Your job is to answer the user's questions " +
        "based ONLY on the provided context and FAQs. If the answer is not in the context, say you don't know " +
        "and suggest adding more documents.\n\n";

      systemPrompt += `Tone: ${tone}. Preferred language: ${language}.\n`;

      if (responseLength === "short") {
        systemPrompt += "Keep responses short and to the point (1-2 sentences).\n";
      } else if (responseLength === "long") {
        systemPrompt += "Provide detailed, structured answers when possible.\n";
      }

      if (systemPromptOverride && systemPromptOverride.trim()) {
        systemPrompt += "\nAdditional system instructions:\n" + systemPromptOverride.trim() + "\n";
      }

      const userPrompt =
        `Context snippets:\n${contextText || "(no document context yet)"}\n\n` +
        (faqsText ? `FAQs:\n${faqsText}\n\n` : "") +
        `User question:\n${message}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      replyText =
        completion.choices[0]?.message?.content?.trim() ||
        "I don't know based on the provided context. Please add more documents.";
    } catch (ragError) {
      console.error("Trial RAG generation failed:", ragError);
    }

    await Message.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: "assistant",
      content: replyText,
      createdAt: new Date(),
    });

    return NextResponse.json({
      reply: replyText,
      usage: {
        allowed: true,
        current: usage.current,
        limit: usage.limit,
      },
    });
  } catch (error) {
    console.error("Trial chat request failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
