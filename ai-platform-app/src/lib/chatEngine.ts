import OpenAI from "openai";

import { getRelevantChunksForBot } from "@/lib/rag";
import { Conversation } from "@/models/Conversation";
import { DocumentModel } from "@/models/Document";
import { Message } from "@/models/Message";

type ChatMode = "demo" | "trial";

type BotLike = {
  _id: { toString(): string };
  openaiApiKeyOverride?: string;
  personality?: {
    tone?: "friendly" | "formal" | "playful" | "technical";
    language?: string;
    systemPrompt?: string;
  };
  config?: {
    temperature?: number;
    maxTokens?: number;
    responseLength?: "short" | "medium" | "long";
  };
  faqs?: Array<{ question: string; answer: string }>;
};

type RunChatInput = {
  bot: BotLike;
  visitorId: string;
  message: string;
  mode: ChatMode;
  userApiKey?: string;
};

export type ChatSource = {
  chunkId: string;
  docId: string;
  docTitle: string;
  preview: string;
  score?: number;
};

export type RunChatResult =
  | {
      ok: true;
      conversationId: string;
      assistantMessage: string;
      sources?: ChatSource[];
      isNewConversation: boolean;
    }
  | {
      ok: false;
      error: "missing_openai_key";
    };

export function resolveOpenAIKey(params: { userApiKey?: string; bot: BotLike }): string {
  const requestKey = String(params.userApiKey || "").trim();
  if (requestKey) return requestKey;

  const botOverride = String(params.bot.openaiApiKeyOverride || "").trim();
  if (botOverride) return botOverride;

  return String(process.env.OPENAI_API_KEY || "").trim();
}

function getOpenAIClient(apiKey: string) {
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey });
}

export async function runChat({ bot, visitorId, message, mode, userApiKey }: RunChatInput): Promise<RunChatResult> {
  const resolvedApiKey = resolveOpenAIKey({ userApiKey, bot });
  if (!resolvedApiKey) {
    return { ok: false, error: "missing_openai_key" };
  }

  const personality = bot.personality ?? {};
  const cfg = bot.config ?? {};

  const tone = personality.tone ?? "friendly";
  const language = personality.language ?? "en";
  const systemPromptOverride = personality.systemPrompt;

  const temperature = typeof cfg.temperature === "number" ? cfg.temperature : 0.2;
  const maxTokens = typeof cfg.maxTokens === "number" ? cfg.maxTokens : 512;
  const responseLength = cfg.responseLength ?? "medium";

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

  await Message.create({
    conversationId: conversation._id,
    botId: bot._id,
    visitorId,
    role: "user",
    content: message,
    createdAt: now,
  });

  const contextChunks = await getRelevantChunksForBot(
    bot._id.toString(),
    message,
    4,
    resolvedApiKey,
  );
  const docIds = Array.from(new Set(contextChunks.map((chunk) => String(chunk.documentId))));
  const relatedDocuments = await DocumentModel.find({ _id: { $in: docIds } })
    .select({ title: 1 })
    .lean();
  const docTitleById = new Map(
    relatedDocuments.map((doc) => [String(doc._id), String(doc.title || "Document")]),
  );

  const sources: ChatSource[] = contextChunks.map((chunk) => ({
    chunkId: String(chunk._id),
    docId: String(chunk.documentId),
    docTitle: docTitleById.get(String(chunk.documentId)) || "Document",
    preview: String(chunk.text || "").slice(0, 120),
    score:
      typeof (chunk as { score?: unknown }).score === "number"
        ? (chunk as { score: number }).score
        : undefined,
  }));

  const contextText = contextChunks.map((c, idx) => `# Snippet ${idx + 1}\n${c.text}`).join("\n\n");
  const faqs = bot.faqs ?? [];
  const faqsText = faqs.length > 0 ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") : "";

  let assistantMessage =
    "I don't know based on the provided context. Please add more documents.";

  try {
    const openai = getOpenAIClient(resolvedApiKey);

    let systemPrompt =
      `You are an AI assistant for a ${mode} chatbot. Your job is to answer the user's questions ` +
      "based ONLY on the provided context and FAQs. If the answer is not in the context, say you don't know " +
      "and suggest adding more documents.\n\n";

    systemPrompt += `Tone: ${tone}. Preferred language: ${language}.\n`;

    if (responseLength === "short") {
      systemPrompt += "Keep responses short and to the point (1-2 sentences).\n";
    } else if (responseLength === "long") {
      systemPrompt += "Provide detailed, structured answers when possible.\n";
    }

    if (systemPromptOverride && systemPromptOverride.trim()) {
      systemPrompt += `\nAdditional system instructions:\n${systemPromptOverride.trim()}\n`;
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

    assistantMessage =
      completion.choices[0]?.message?.content?.trim() ||
      "I don't know based on the provided context. Please add more documents.";
  } catch (chatError) {
    console.error("Chat generation failed:", chatError);
  }

  await Message.create({
    conversationId: conversation._id,
    botId: bot._id,
    visitorId,
    role: "assistant",
    content: assistantMessage,
    createdAt: new Date(),
  });

  return {
    ok: true,
    conversationId: conversation._id.toString(),
    assistantMessage,
    sources: sources.length ? sources : undefined,
    isNewConversation,
  };
}
