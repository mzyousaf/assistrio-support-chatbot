import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { getDefaultNewBotDocuments } from './default-new-bot.payload';

const INTERNAL_NOTES_PLACEHOLDER =
  'Assistrio is an AI-powered support assistant. It helps users find answers from your knowledge base, documentation, and FAQs. Customize this overview to describe your company and what this bot can help with.';
const DEFAULT_FAQS: Array<{ question: string; answer: string }> = [
  { question: 'What services do you offer?', answer: 'We offer support and guidance through this assistant. Specific services depend on the knowledge base configured for this bot.' },
  { question: 'How can I contact support?', answer: 'You can ask questions here. For direct contact, use the links in the chat menu or your company\'s contact page.' },
  { question: 'Do you offer refunds?', answer: 'Refund policies depend on your company. Check the knowledge base documents or contact support for your specific case.' },
];

@Injectable()
export class BotOnboardingService {
  constructor(
    private readonly config: ConfigService,
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
  ) {}

  private getOpenAIClient(): OpenAI | null {
    const apiKey = (this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  }

  /**
   * Generate internal notes / knowledge overview for a new bot using OpenAI.
   * Returns placeholder if no API key or on error.
   */
  async generateInternalNotes(botName: string, description: string): Promise<string> {
    const openai = this.getOpenAIClient();
    if (!openai) return INTERNAL_NOTES_PLACEHOLDER;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You write short internal overviews for an AI support assistant knowledge base. Output only the overview text, no headings or labels. Keep it to 2–4 sentences.',
          },
          {
            role: 'user',
            content: `Bot name: ${botName}\nDescription: ${description || 'AI support assistant.'}\nWrite a brief internal overview for the knowledge base.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 300,
      });
      const text = completion.choices[0]?.message?.content?.trim();
      return text || INTERNAL_NOTES_PLACEHOLDER;
    } catch {
      return INTERNAL_NOTES_PLACEHOLDER;
    }
  }

  /**
   * Generate FAQs for a new bot using OpenAI.
   * Returns default FAQs if no API key or on error.
   */
  async generateFaqs(botName: string, description: string): Promise<Array<{ question: string; answer: string }>> {
    const openai = this.getOpenAIClient();
    if (!openai) return DEFAULT_FAQS;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You generate 3–5 short FAQ pairs for an AI support assistant. Reply with a JSON array only, no markdown or extra text. Each item: { "question": "...", "answer": "..." }. Questions should be common user questions; answers 1–2 sentences.`,
          },
          {
            role: 'user',
            content: `Bot name: ${botName}\nDescription: ${description || 'AI support assistant.'}\nGenerate FAQ pairs as a JSON array.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 600,
      });
      const raw = completion.choices[0]?.message?.content?.trim();
      if (!raw) return DEFAULT_FAQS;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return DEFAULT_FAQS;
      const faqs = parsed
        .filter(
          (x): x is { question: string; answer: string } =>
            x != null &&
            typeof x === 'object' &&
            typeof (x as { question?: unknown }).question === 'string' &&
            typeof (x as { answer?: unknown }).answer === 'string',
        )
        .map((x) => ({ question: x.question.trim(), answer: x.answer.trim() }))
        .filter((x) => x.question && x.answer)
        .slice(0, 6);
      return faqs.length > 0 ? faqs : DEFAULT_FAQS;
    } catch {
      return DEFAULT_FAQS;
    }
  }

  /**
   * After a new bot is created: generate internal notes and FAQs (AI), update bot, add default documents, queue ingestion.
   */
  async onboardNewBot(botId: string): Promise<{ docsQueued: number }> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) return { docsQueued: 0 };
    const b = bot as { name?: string; description?: string };
    const name = String(b.name ?? 'AI Support Assistant').trim();
    const description = String(b.description ?? '').trim();

    const [internalNotes, faqs] = await Promise.all([
      this.generateInternalNotes(name, description),
      this.generateFaqs(name, description),
    ]);

    await this.botsService.update(botId, {
      knowledgeDescription: internalNotes,
      faqs,
    });

    const docs = getDefaultNewBotDocuments();
    let docsQueued = 0;
    for (const doc of docs) {
      const created = await this.documentsService.create({
        botId,
        title: doc.title,
        sourceType: 'url',
        url: doc.url,
        status: 'queued',
        fileName: doc.fileName,
        fileSize: doc.fileSize,
      });
      const docId = (created as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((created as { _id?: unknown })._id);
      await this.ingestionService.createQueuedJob(botId, docId);
      docsQueued += 1;
    }
    return { docsQueued };
  }
}
