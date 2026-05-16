import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { BotsService } from '../../bots/bots.service';
import { DocumentsService } from '../../documents/documents.service';
import { IngestionService } from '../../ingestion/ingestion.service';
import { KnowledgeBaseItemService } from '../../knowledge/knowledge-base-item.service';
import { getDefaultNewBotDocuments } from './default-new-bot.payload';
import { parseExampleQuestionsFromDoc } from './example-questions.util';

const INTERNAL_NOTES_PLACEHOLDER =
  'Assistrio is an AI-powered support assistant. It helps users find answers from your knowledge base, documentation, and FAQs. Customize this overview to describe your company and what this bot can help with.';
/** Starter FAQs only; wording must not mirror `behavior.suggestedQuestions` (those become suggestion chips). */
const DEFAULT_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: 'How does this assistant find answers?',
    answer:
      'It replies using your uploaded documents, FAQs, and notes configured for this bot. Add or edit knowledge in the dashboard to improve accuracy.',
  },
  {
    question: 'What should I do if an answer seems wrong?',
    answer:
      'Try rephrasing your question or asking for a specific detail. You can also reach your team through the links in the chat menu when direct support is needed.',
  },
  {
    question: 'Where does this bot get its information?',
    answer:
      'Only from the knowledge sources you connect—files, Q&A, snippets, and similar content you approve for this assistant.',
  },
];

@Injectable()
export class BotOnboardingService {
  constructor(
    private readonly config: ConfigService,
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
  ) { }

  private normalizeComparableQuestion(q: string): string {
    return q.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  /**
   * Drop FAQs whose question matches a suggested chip (same KB twice) and dedupe by question text.
   */
  private faqsAvoidingSuggestionChips(
    faqs: Array<{ question: string; answer: string }>,
    chipQuestions: string[],
    minKeep: number,
  ): Array<{ question: string; answer: string }> {
    const chipSet = new Set(
      chipQuestions.map((q) => this.normalizeComparableQuestion(String(q ?? ''))).filter(Boolean),
    );
    const takeUnique = (source: Array<{ question: string; answer: string }>) => {
      const seen = new Set<string>();
      const out: Array<{ question: string; answer: string }> = [];
      for (const faq of source) {
        const key = this.normalizeComparableQuestion(faq.question);
        if (!key || chipSet.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(faq);
      }
      return out;
    };
    let out = takeUnique(faqs);
    if (out.length >= minKeep) {
      return out.slice(0, 6);
    }
    for (const fallback of DEFAULT_FAQS) {
      if (out.length >= minKeep) break;
      out = takeUnique([...out, fallback]);
    }
    return out.length > 0 ? out.slice(0, 6) : DEFAULT_FAQS.slice();
  }

  private getOpenAIClient(): OpenAI | null {
    const apiKey = (this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) return null;
    return new OpenAI({ apiKey });
  }

  async generateInternalNotes(botName: string, description: string): Promise<string> {
    const openai = this.getOpenAIClient();
    if (!openai) return INTERNAL_NOTES_PLACEHOLDER;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You write short internal overviews for an AI support assistant knowledge base. Output only the overview text, no headings or labels. Keep it to 2–4 sentences.' },
          { role: 'user', content: `Bot name: ${botName}\nDescription: ${description || 'AI support assistant.'}\nWrite a brief internal overview for the knowledge base.` },
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

  async generateFaqs(
    botName: string,
    description: string,
    avoidQuestions: string[] = [],
  ): Promise<Array<{ question: string; answer: string }>> {
    const openai = this.getOpenAIClient();
    if (!openai) return DEFAULT_FAQS;
    const avoid =
      avoidQuestions.length > 0
        ? `\nDo not use these questions (they are already quick-reply chips): ${avoidQuestions.join(' | ')}`
        : '';
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You generate 3–5 short FAQ pairs for an AI support assistant. Reply with a JSON array only, no markdown or extra text. Each item: { "question": "...", "answer": "..." }. Questions should be common user questions; answers 1–2 sentences. Do not repeat the exact same questions as the chat\'s suggested quick-question chips (the client sends those separately)—cover complementary topics instead.',
          },
          {
            role: 'user',
            content: `Bot name: ${botName}\nDescription: ${description || 'AI support assistant.'}${avoid}\nGenerate FAQ pairs as a JSON array.`,
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
            x != null && typeof x === 'object' &&
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

  async onboardNewBot(botId: string): Promise<{ docsQueued: number }> {
    const bot = await this.botsService.findOne(botId);
    if (!bot) return { docsQueued: 0 };
    const b = bot as { name?: string; description?: string; exampleQuestions?: unknown };
    const name = String(b.name ?? 'AI Support Assistant').trim();
    const description = String(b.description ?? '').trim();
    const suggestionDocs = parseExampleQuestionsFromDoc(b.exampleQuestions ?? []);
    const chipQuestionLabels = suggestionDocs.map((d) => d.label).filter(Boolean);
    const trainingSettings = await this.knowledgeBaseItemService.getKnowledgeTrainingSettingsForBot(botId);
    const [internalNotes, faqsRaw] = await Promise.all([
      this.generateInternalNotes(name, description),
      this.generateFaqs(name, description, chipQuestionLabels),
    ]);
    const faqs = this.faqsAvoidingSuggestionChips(faqsRaw, chipQuestionLabels, 3);
    await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botId, internalNotes);
    await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botId, faqs);
    await this.knowledgeBaseItemService.upsertSuggestionKnowledgeItemsForBot(botId, suggestionDocs);
    const docs = getDefaultNewBotDocuments();
    let docsQueued = 0;
    const docTrainingStatus = trainingSettings.autoTrainEnabled ? 'queued' : 'pending';
    for (const doc of docs) {
      const created = await this.documentsService.create({
        botId,
        title: doc.title,
        sourceType: 'url',
        url: doc.url,
        status: docTrainingStatus,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
      });
      const docId = (created as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((created as { _id?: unknown })._id);
      if (trainingSettings.autoTrainEnabled) {
        await this.ingestionService.createQueuedJob(botId, docId);
        docsQueued += 1;
      }
    }
    return { docsQueued };
  }
}
