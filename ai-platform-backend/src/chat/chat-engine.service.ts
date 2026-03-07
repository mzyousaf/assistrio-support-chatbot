import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import OpenAI from 'openai';
import { Conversation, DocumentModel, Message } from '../models';
import { RagService } from '../rag/rag.service';
import type { BotLike, RunChatInput, RunChatResult } from './chat-engine.types';

@Injectable()
export class ChatEngineService {
  constructor(
    private readonly config: ConfigService,
    private readonly ragService: RagService,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
  ) {}

  resolveOpenAIKey(params: { userApiKey?: string; bot: BotLike }): string {
    const requestKey = String(params.userApiKey || '').trim();
    if (requestKey) return requestKey;

    const botOverride = String(params.bot.openaiApiKeyOverride || '').trim();
    if (botOverride) return botOverride;

    return String(this.config.get<string>('openaiApiKey') || '').trim();
  }

  async runChat({
    bot,
    visitorId,
    message,
    mode,
    userApiKey,
  }: RunChatInput): Promise<RunChatResult> {
    const resolvedApiKey = this.resolveOpenAIKey({ userApiKey, bot });
    if (!resolvedApiKey) {
      return { ok: false, error: 'missing_openai_key' };
    }

    const personality = bot.personality ?? {};
    const cfg = bot.config ?? {};

    const tone = personality.tone ?? 'friendly';
    const language = personality.language ?? 'en';
    const systemPromptOverride = personality.systemPrompt;

    const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.2;
    const maxTokens = typeof cfg.maxTokens === 'number' ? cfg.maxTokens : 512;
    const responseLength = cfg.responseLength ?? 'medium';

    const now = new Date();
    let conversation = await this.conversationModel.findOne({
      botId: bot._id,
      visitorId,
    });
    let isNewConversation = false;

    if (!conversation) {
      conversation = await this.conversationModel.create({
        botId: bot._id,
        visitorId,
        createdAt: now,
      });
      isNewConversation = true;
      const welcomeText =
        typeof (bot as { welcomeMessage?: string }).welcomeMessage === 'string'
          ? (bot as { welcomeMessage: string }).welcomeMessage.trim()
          : '';
      if (welcomeText) {
        await this.messageModel.create({
          conversationId: conversation._id,
          botId: bot._id,
          visitorId,
          role: 'assistant',
          content: welcomeText,
          createdAt: now,
        });
      }
    }

    await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: 'user',
      content: message,
      createdAt: now,
    });

    const contextChunks = await this.ragService.getRelevantChunksForBot(
      bot._id.toString(),
      message,
      4,
      resolvedApiKey,
    );
    const docIds = Array.from(new Set(contextChunks.map((chunk) => String(chunk.documentId))));
    const relatedDocuments = await this.documentModel
      .find({ _id: { $in: docIds } })
      .select({ title: 1 })
      .lean();
    const docTitleById = new Map(
      relatedDocuments.map((doc) => [String(doc._id), String((doc as { title?: string }).title || 'Document')]),
    );

    const sources = contextChunks.map((chunk) => {
      const scoreVal = (chunk as { score?: unknown }).score;
      return {
        chunkId: String(chunk._id),
        docId: String(chunk.documentId),
        docTitle: docTitleById.get(String(chunk.documentId)) || 'Document',
        preview: String(chunk.text || '').slice(0, 120),
        score: typeof scoreVal === 'number' ? scoreVal : undefined,
      };
    });

    const contextText = contextChunks.map((c, idx) => `# Snippet ${idx + 1}\n${c.text}`).join('\n\n');
    const faqs = bot.faqs ?? [];
    const faqsText = faqs.length > 0 ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') : '';

    let assistantMessage =
      "I don't know based on the provided context. Please add more documents.";

    try {
      const openai = new OpenAI({ apiKey: resolvedApiKey });
      const modeLabel = mode === 'super_admin' ? 'admin' : mode;

      let systemPrompt =
        `You are an AI assistant for a ${modeLabel} chatbot. Your job is to answer the user's questions ` +
        "based ONLY on the provided context and FAQs. If the answer is not in the context, say you don't know " +
        "and suggest adding more documents.\n\n";

      systemPrompt += `Tone: ${tone}. Preferred language: ${language}.\n`;

      if (responseLength === 'short') {
        systemPrompt += 'Keep responses short and to the point (1-2 sentences).\n';
      } else if (responseLength === 'long') {
        systemPrompt += 'Provide detailed, structured answers when possible.\n';
      }

      if (systemPromptOverride && systemPromptOverride.trim()) {
        systemPrompt += `\nAdditional system instructions:\n${systemPromptOverride.trim()}\n`;
      }

      const thingsToAvoid = (personality as { thingsToAvoid?: string }).thingsToAvoid;
      if (thingsToAvoid && thingsToAvoid.trim()) {
        systemPrompt += `\nThings to avoid (do not engage with these topics or behaviours):\n${thingsToAvoid.trim()}\n`;
      }

      const userPrompt =
        `Context snippets:\n${contextText || '(no document context yet)'}\n\n` +
        (faqsText ? `FAQs:\n${faqsText}\n\n` : '') +
        `User question:\n${message}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      assistantMessage =
        completion.choices[0]?.message?.content?.trim() ||
        "I don't know based on the provided context. Please add more documents.";
    } catch (chatError) {
      console.error('Chat generation failed:', chatError);
    }

    await this.messageModel.create({
      conversationId: conversation._id,
      botId: bot._id,
      visitorId,
      role: 'assistant',
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
}
