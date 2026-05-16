import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import OpenAI from 'openai';
import { Conversation, Message } from '../models';
import { chatLog } from '../chat/chat-logger';
import { withTimeout } from '../lib/ai-call.helper';
import {
  TOPIC_SENTIMENT_DEFAULT_MODEL,
  TOPIC_SENTIMENT_MAX_INPUT_CHARS,
  TOPIC_SENTIMENT_MIN_CHARS_FOR_LLM,
  TOPIC_SENTIMENT_ROLLUP_USER_MESSAGE_WINDOW,
  TOPIC_TAXONOMY_IDS,
} from './topic-sentiment-classification.constants';
import {
  fallbackClassificationForShortOrEmptyInput,
  parseTopicSentimentJsonFromModelText,
  rollupConversationTopicSentimentFromUserMessages,
  sanitizeLlmClassificationPayload,
} from './topic-sentiment-classification.util';
import type { SanitizedMessageClassification } from './topic-sentiment-classification.types';

const CLASSIFY_TIMEOUT_MS = Math.max(
  5000,
  Math.min(120_000, Number(process.env.TOPIC_SENTIMENT_TIMEOUT_MS) || 22_000),
);

const SYSTEM_PROMPT = `You are a strict JSON classifier for customer support chat analytics.

Task: From the visitor message, infer (1) main business/support topic tags, (2) optional finer-grained sub-topics, and (3) emotional tone only.

Rules:
- Classify only business/support topic and tone. Do not classify sensitive personal attributes.
- Do not infer race, religion, politics, health conditions, sexual orientation, criminal status, or similar.
- Do not invent sensitive identity topics (e.g. do not output topics about the visitor's protected traits).
- If the message is sensitive, off-topic, or unclear, prefer primaryTopic "general_question" or "other".
- Return a single JSON object only. No markdown, no chain-of-thought, no extra keys.
- topicConfidence: number 0-1.
- primaryTopic: one string from the allowed MAIN topic list (exact snake_case).
- topicLabels: up to 3 distinct MAIN topic ids from the same list; must include primaryTopic.
- primarySubTopic: optional snake_case id; must be a valid sub-topic for primaryTopic when set (server validates).
- subTopicLabels: up to 5 distinct snake_case sub-topic ids; each must be valid under at least one id in topicLabels (including primaryTopic). Prefer subs that match the message; omit unknown tokens.

sentiment object:
- label: one of positive | neutral | negative | mixed | unknown
- score: number from -1 (very negative) to 1 (very positive)
- reason: optional, max ~12 words, describe tone only (no quoting the user, no PII).

Allowed primaryTopic / topicLabels (MAIN topics, exact snake_case only):
${TOPIC_TAXONOMY_IDS.join(', ')}

Sub-topics are not listed here; the server drops unknown sub-topic ids. Use concise snake_case ids (e.g. failed_payment, refund_request).`;

@Injectable()
export class TopicSentimentClassificationService {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
  ) {}

  private resolveApiKey(): string {
    return String(this.config.get<string>('openaiApiKey') || '').trim();
  }

  private resolveModel(): string {
    const m = String(process.env.TOPIC_SENTIMENT_MODEL || '').trim();
    return m || TOPIC_SENTIMENT_DEFAULT_MODEL;
  }

  private textForClassification(doc: { content?: string; englishText?: string }): string {
    const raw = String(doc.englishText ?? doc.content ?? '').trim();
    if (!raw) return '';
    if (raw.length <= TOPIC_SENTIMENT_MAX_INPUT_CHARS) return raw;
    return raw.slice(0, TOPIC_SENTIMENT_MAX_INPUT_CHARS);
  }

  /**
   * Fire-and-forget safe entrypoint for chat: logs errors, never throws.
   */
  async safeClassifyUserMessageById(messageId: string): Promise<void> {
    try {
      await this.classifyUserMessageById(messageId);
    } catch (err) {
      chatLog({
        event: 'topic_sentiment.classify_failed',
        level: 'warn',
        metadata: {
          messageId,
          reason: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
        },
      });
    }
  }

  /**
   * Classify one user message by id. May throw (e.g. OpenAI failure) — use {@link safeClassifyUserMessageById} from chat.
   */
  async classifyUserMessageById(messageId: string): Promise<void> {
    if (!Types.ObjectId.isValid(messageId)) return;
    const doc = await this.messageModel.findById(new Types.ObjectId(messageId)).lean();
    if (!doc) return;
    await this.classifyUserMessageDocument(doc as Message & { _id: Types.ObjectId; conversationId?: Types.ObjectId });
  }

  async classifyUserMessageDocument(
    doc: Message & { _id: Types.ObjectId; conversationId?: Types.ObjectId },
  ): Promise<void> {
    if (String(doc.role) !== 'user') return;
    const convId = doc.conversationId;
    if (!convId) return;

    const text = this.textForClassification(doc);
    let sanitized: SanitizedMessageClassification;

    if (text.length < TOPIC_SENTIMENT_MIN_CHARS_FOR_LLM) {
      sanitized = fallbackClassificationForShortOrEmptyInput();
    } else {
      try {
        sanitized = await this.classifyTextWithLlm(text);
      } catch (err) {
        chatLog({
          event: 'topic_sentiment.llm_failed',
          level: 'warn',
          metadata: {
            messageId: String(doc._id),
            reason: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
          },
        });
        sanitized = fallbackClassificationForShortOrEmptyInput();
      }
    }

    await this.messageModel.updateOne(
      { _id: doc._id, role: 'user' },
      {
        $set: {
          topics: sanitized.topics,
          sentiment: sanitized.sentiment,
        },
      },
    );

    await this.rollupConversationTopicSentiment(convId);
  }

  private async classifyTextWithLlm(userText: string): Promise<SanitizedMessageClassification> {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return fallbackClassificationForShortOrEmptyInput();
    }
    const openai = new OpenAI({ apiKey });
    const model = this.resolveModel();
    const user = `Visitor message:\n${userText}`;

    const completion = await withTimeout(
      openai.chat.completions.create({
        model,
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
      }),
      CLASSIFY_TIMEOUT_MS,
      'topic_sentiment',
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed = parseTopicSentimentJsonFromModelText(raw);
    if (!parsed) {
      return fallbackClassificationForShortOrEmptyInput();
    }
    return sanitizeLlmClassificationPayload(parsed);
  }

  async rollupConversationTopicSentiment(conversationId: Types.ObjectId): Promise<void> {
    try {
      const rows = await this.messageModel
        .find({
          conversationId,
          role: 'user',
        })
        .sort({ createdAt: -1 })
        .limit(TOPIC_SENTIMENT_ROLLUP_USER_MESSAGE_WINDOW)
        .select({ createdAt: 1, topics: 1, sentiment: 1 })
        .lean();

      const chronological = [...rows].reverse();
      const slices = chronological.map((r) => {
        const t = r.topics as {
          primaryTopic?: string;
          topicLabels?: string[];
          primarySubTopic?: string;
          subTopicLabels?: string[];
        } | undefined;
        const s = r.sentiment as { label?: string; score?: number } | undefined;
        return {
          createdAt: r.createdAt instanceof Date ? r.createdAt : new Date(),
          primaryTopic: t?.primaryTopic,
          topicLabels: t?.topicLabels,
          primarySubTopic: t?.primarySubTopic,
          subTopicLabels: t?.subTopicLabels,
          sentimentLabel: s?.label,
          sentimentScore: s?.score,
        };
      });

      const rolled = rollupConversationTopicSentimentFromUserMessages(slices);
      if (!rolled) {
        await this.conversationModel.updateOne(
          { _id: conversationId },
          { $unset: { conversationTopics: '', conversationSentiment: '' } },
        );
        return;
      }

      await this.conversationModel.updateOne(
        { _id: conversationId },
        {
          $set: {
            conversationTopics: rolled.conversationTopics,
            conversationSentiment: rolled.conversationSentiment,
          },
        },
      );
    } catch (err) {
      chatLog({
        event: 'topic_sentiment.rollup_failed',
        level: 'warn',
        metadata: {
          conversationId: String(conversationId),
          reason: err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240),
        },
      });
    }
  }

  /**
   * Backfill unclassified user messages (oldest first). For manual/on-demand use only — no product cron schedules this.
   */
  async classifyUnclassifiedBatch(limit = 25): Promise<{ attempted: number; completed: number; failed: number }> {
    const cap = Math.max(1, Math.min(100, limit));
    let attempted = 0;
    let completed = 0;
    let failed = 0;

    const docs = await this.messageModel
      .find({
        role: 'user',
        $or: [
          { topics: { $exists: false } },
          { 'topics.primaryTopic': { $exists: false } },
          { sentiment: { $exists: false } },
          { 'sentiment.label': { $exists: false } },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(cap)
      .select({ _id: 1 })
      .lean();

    for (const d of docs) {
      const id = d._id as Types.ObjectId;
      attempted += 1;
      try {
        await this.classifyUserMessageById(id.toString());
        completed += 1;
      } catch {
        failed += 1;
      }
    }

    return { attempted, completed, failed };
  }
}
