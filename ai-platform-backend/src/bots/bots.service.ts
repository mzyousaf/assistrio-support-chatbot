import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Bot,
  Conversation,
  DocumentModel,
  IngestJob,
  KnowledgeBaseChunk,
  KnowledgeBaseItem,
  Message,
  SummaryJob,
  VisitorEvent,
} from '../models';
import { getDefaultBotCreatePayload } from '../user/default-new-bot.payload';
import { KnowledgeBaseItemService } from '../knowledge/knowledge-base-item.service';
import { KnowledgeBaseChunkService } from '../knowledge/knowledge-base-chunk.service';

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'bot';
}

export interface PublicBotDto {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string;
  category?: string;
  avatarEmoji?: string;
  imageUrl?: string;
  exampleQuestions: string[];
  chatUI?: {
    primaryColor?: string;
    backgroundStyle?: string;
    bubbleBorderRadius?: number;
    launcherPosition?: string;
    showBranding?: boolean;
    timePosition?: 'top' | 'bottom';
  };
  createdAt: string;
}

@Injectable()
export class BotsService {
  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentModel>,
    @InjectModel(KnowledgeBaseItem.name) private readonly knowledgeBaseItemModel: Model<KnowledgeBaseItem>,
    @InjectModel(KnowledgeBaseChunk.name) private readonly knowledgeBaseChunkModel: Model<KnowledgeBaseChunk>,
    @InjectModel(IngestJob.name) private readonly ingestJobModel: Model<IngestJob>,
    @InjectModel(SummaryJob.name) private readonly summaryJobModel: Model<SummaryJob>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(VisitorEvent.name) private readonly visitorEventModel: Model<VisitorEvent>,
    private readonly knowledgeBaseItemService: KnowledgeBaseItemService,
    private readonly knowledgeBaseChunkService: KnowledgeBaseChunkService,
  ) { }

  async findAll() {
    return this.botModel.find().lean();
  }

  /** List bots for user panel with optional status filter (showcase only). */
  async findForAdminList(status?: 'draft' | 'published' | 'all') {
    const filter: { type: string; status?: 'draft' | 'published' } = { type: 'showcase' };
    if (status && status !== 'all') filter.status = status;
    return this.botModel
      .find(filter)
      .sort({ createdAt: -1 })
      .select('name type category status isPublic createdAt _id slug')
      .lean();
  }

  async findPublicShowcase(): Promise<PublicBotDto[]> {
    const docs = await this.botModel
      .find({
        type: 'showcase',
        isPublic: true,
        status: 'published',
      })
      .sort({ createdAt: -1 })
      .select(
        '_id name slug shortDescription category avatarEmoji imageUrl exampleQuestions chatUI createdAt',
      )
      .lean();

    return docs.map((bot: Record<string, unknown>) => ({
      id: String(bot._id),
      name: String(bot.name ?? ''),
      slug: String(bot.slug ?? ''),
      shortDescription: bot.shortDescription != null ? String(bot.shortDescription) : undefined,
      category: bot.category != null ? String(bot.category) : undefined,
      avatarEmoji: bot.avatarEmoji != null ? String(bot.avatarEmoji) : undefined,
      imageUrl: bot.imageUrl != null ? String(bot.imageUrl) : undefined,
      exampleQuestions: Array.isArray(bot.exampleQuestions)
        ? (bot.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
        : [],
      chatUI: bot.chatUI as PublicBotDto['chatUI'] | undefined,
      createdAt:
        bot.createdAt instanceof Date
          ? bot.createdAt.toISOString()
          : String(bot.createdAt ?? ''),
    }));
  }

  async findOne(id: string) {
    return this.botModel.findById(id).lean();
  }

  /** Check if a slug exists (any type). */
  async findOneBySlug(slug: string) {
    return this.botModel.findOne({ slug: slug.trim().toLowerCase() }).select('_id').lean();
  }

  /** Find showcase bot by slug for chat (returns BotLike shape; faqs and knowledgeDescription from KB). */
  async findOneBySlugForChat(slug: string) {
    const bot = await this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'showcase' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage leadCapture personality config type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Find visitor-own bot by slug for chat (faqs and knowledgeDescription from KB). */
  async findOneBySlugTrial(slug: string) {
    const bot = await this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'visitor-own' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage leadCapture personality config type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(String((bot as { _id: unknown })._id)),
      this.knowledgeBaseItemService.getNoteContentForBot(String((bot as { _id: unknown })._id)),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  /** Find one bot by slug for demo/trial page (public shape; faqs from KB). */
  async findOneBySlugForPage(
    slug: string,
    type: 'showcase' | 'visitor-own',
  ): Promise<{
    id: string;
    slug: string;
    name: string;
    shortDescription: string;
    avatarEmoji: string;
    imageUrl: string;
    welcomeMessage?: string;
    chatUI?: unknown;
    faqs: Array<{ question: string; answer: string }>;
    exampleQuestions: string[];
  } | null> {
    const doc = await this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type })
      .select('_id slug name shortDescription avatarEmoji imageUrl welcomeMessage chatUI exampleQuestions')
      .lean();
    if (!doc) return null;
    const b = doc as Record<string, unknown>;
    const botId = String(b._id);
    const faqs = await this.knowledgeBaseItemService.getFaqsForBot(botId);
    const welcomeMsg = typeof b.welcomeMessage === 'string' && b.welcomeMessage.trim() ? b.welcomeMessage.trim() : undefined;
    return {
      id: botId,
      slug: String(b.slug ?? ''),
      name: String(b.name ?? ''),
      shortDescription: String(b.shortDescription ?? ''),
      avatarEmoji: String(b.avatarEmoji ?? '💬'),
      imageUrl: String(b.imageUrl ?? ''),
      welcomeMessage: welcomeMsg,
      chatUI: b.chatUI as unknown,
      faqs,
      exampleQuestions: Array.isArray(b.exampleQuestions)
        ? (b.exampleQuestions as unknown[]).map((q) => String(q ?? '').trim()).filter(Boolean) as string[]
        : [],
    };
  }

  /** Find bot by id, for ownership check (id + ownerVisitorId + type). */
  async findOneForOwnership(id: string) {
    return this.botModel
      .findById(id)
      .select('_id ownerVisitorId type')
      .lean();
  }

  /** Generate unique slug; optionally exclude a bot id from collision check. */
  async generateUniqueSlug(base: string, excludeBotId?: string): Promise<string> {
    const normalized = slugify(base);
    const query = excludeBotId
      ? { slug: normalized, _id: { $ne: excludeBotId } }
      : { slug: normalized };
    const existing = await this.botModel.findOne(query).select('_id').lean();
    if (!existing) return normalized;
    for (let attempt = 2; attempt <= 50; attempt++) {
      const candidate = `${normalized}-${attempt}`;
      const q = excludeBotId ? { slug: candidate, _id: { $ne: excludeBotId } } : { slug: candidate };
      const collides = await this.botModel.findOne(q).select('_id').lean();
      if (!collides) return candidate;
    }
    return `${normalized}-${Date.now()}`;
  }

  /** Find showcase bot for user panel GET (faqs and knowledgeDescription from KB). */
  async findOneShowcaseForAdmin(id: string) {
    const bot = await this.botModel
      .findById(id)
      .select('slug name shortDescription description category categories imageUrl openaiApiKeyOverride whisperApiKeyOverride welcomeMessage status isPublic leadCapture chatUI exampleQuestions personality type config limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge includeNotesInKnowledge')
      .lean();
    if (!bot) return null;
    const [faqs, knowledgeDescription] = await Promise.all([
      this.knowledgeBaseItemService.getFaqsForBot(id, { includeInactive: true }),
      this.knowledgeBaseItemService.getNoteContentForBot(id),
    ]);
    return { ...bot, faqs, knowledgeDescription } as Record<string, unknown>;
  }

  async create(data: Record<string, unknown>) {
    const doc = await this.botModel.create(data);
    return doc.toObject();
  }

  async createDraft(clientDraftId: string): Promise<{ botId: string; slug: string }> {
    const existing = await this.botModel
      .findOne({ clientDraftId, status: 'draft', type: 'showcase' })
      .select('_id slug')
      .lean();
    if (existing) {
      return { botId: String((existing as { _id: unknown })._id), slug: (existing as { slug: string }).slug };
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug('ai-support-assistant');
      try {
        const payload = getDefaultBotCreatePayload(slug, clientDraftId);
        const created = await this.botModel.create(payload as unknown as Record<string, unknown>);
        return { botId: String((created as { _id: unknown })._id), slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (e.code === 11000 && e.keyPattern?.clientDraftId) {
          const dup = await this.botModel.findOne({ clientDraftId, status: 'draft', type: 'showcase' }).select('_id slug').lean();
          if (dup) return { botId: String((dup as { _id: unknown })._id), slug: (dup as { slug: string }).slug };
        }
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async finalizeDraft(
    clientDraftId: string,
    normalized: {
      name: string;
      shortDescription?: string;
      description?: string;
      categories: string[];
      imageUrl?: string;
      openaiApiKeyOverride?: string;
      whisperApiKeyOverride?: string;
      welcomeMessage?: string;
      knowledgeDescription?: string;
      leadCapture?: unknown;
      chatUI?: unknown;
      faqs?: unknown;
      exampleQuestions?: string[];
      personality?: unknown;
      config?: unknown;
      limitOverrideMessages?: number;
      isPublic: boolean;
      includeNameInKnowledge?: boolean;
      includeTaglineInKnowledge?: boolean;
      includeNotesInKnowledge: boolean;
    },
  ): Promise<{ botId: string; slug: string }> {
    const finalName = normalized.name || 'Draft bot';
    const finalDescription = normalized.description || '';
    const existing = await this.botModel.findOne({ clientDraftId }).select('_id slug name createdAt').lean();
    if (existing) {
      let finalSlug = (existing as { slug: string }).slug;
      const shouldUpdateSlug = finalName !== String((existing as { name?: string }).name ?? '');
      if (!finalSlug || shouldUpdateSlug) {
        finalSlug = await this.generateUniqueSlug(finalName || 'draft-bot', String((existing as { _id: unknown })._id));
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await this.botModel.updateOne(
            { _id: (existing as { _id: unknown })._id },
            {
              name: finalName,
              slug: finalSlug,
              shortDescription: normalized.shortDescription,
              description: finalDescription,
              categories: normalized.categories,
              category: normalized.categories?.[0],
              imageUrl: normalized.imageUrl,
              openaiApiKeyOverride: normalized.openaiApiKeyOverride,
              whisperApiKeyOverride: normalized.whisperApiKeyOverride,
              welcomeMessage: normalized.welcomeMessage,
              leadCapture: normalized.leadCapture,
              chatUI: normalized.chatUI,
              exampleQuestions: normalized.exampleQuestions ?? [],
              personality: normalized.personality,
              config: normalized.config,
              limitOverrideMessages: normalized.limitOverrideMessages,
              type: 'showcase',
              status: 'published',
              clientDraftId: undefined,
              isPublic: normalized.isPublic,
              includeNameInKnowledge: normalized.includeNameInKnowledge,
              includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
              includeNotesInKnowledge: normalized.includeNotesInKnowledge,
            },
          );
          const botIdStr = String((existing as { _id: unknown })._id);
          const finalFaqs = Array.isArray(normalized.faqs)
            ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
              question: String(f?.question ?? '').trim(),
              answer: String(f?.answer ?? '').trim(),
              active: f?.active !== false,
            })).filter((f) => f.question || f.answer)
            : [];
          const finalNote = String(normalized.knowledgeDescription ?? '').trim();
          await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
          await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
          await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
          await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
          return { botId: botIdStr, slug: finalSlug };
        } catch (err: unknown) {
          const e = err as { code?: number; keyPattern?: Record<string, number> };
          if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
          finalSlug = await this.generateUniqueSlug(finalName || 'draft-bot', String((existing as { _id: unknown })._id));
        }
      }
      throw new Error('Failed to allocate unique slug.');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = await this.generateUniqueSlug(finalName || 'draft-bot');
      try {
        const created = await this.botModel.create({
          name: finalName,
          slug,
          shortDescription: normalized.shortDescription,
          description: finalDescription,
          categories: normalized.categories,
          category: normalized.categories?.[0],
          imageUrl: normalized.imageUrl,
          openaiApiKeyOverride: normalized.openaiApiKeyOverride,
          whisperApiKeyOverride: normalized.whisperApiKeyOverride,
          welcomeMessage: normalized.welcomeMessage,
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          exampleQuestions: normalized.exampleQuestions ?? [],
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          type: 'showcase',
          status: 'published',
          isPublic: normalized.isPublic,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          includeNotesInKnowledge: normalized.includeNotesInKnowledge,
          createdAt: new Date(),
        });
        const botIdStr = String((created as { _id: unknown })._id);
        const finalFaqs = Array.isArray(normalized.faqs)
          ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
            question: String(f?.question ?? '').trim(),
            answer: String(f?.answer ?? '').trim(),
            active: f?.active !== false,
          })).filter((f) => f.question || f.answer)
          : [];
        const finalNote = String(normalized.knowledgeDescription ?? '').trim();
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(botIdStr, finalFaqs);
        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(botIdStr, finalNote);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(botIdStr);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(botIdStr);
        return { botId: botIdStr, slug: (created as { slug: string }).slug };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async updateShowcase(
    id: string,
    normalized: {
      name: string;
      shortDescription?: string;
      description?: string;
      categories: string[];
      imageUrl?: string;
      openaiApiKeyOverride?: string;
      whisperApiKeyOverride?: string;
      welcomeMessage?: string;
      knowledgeDescription?: string;
      leadCapture?: unknown;
      chatUI?: unknown;
      faqs?: unknown;
      exampleQuestions?: string[];
      personality?: unknown;
      config?: unknown;
      limitOverrideMessages?: number;
      isPublic: boolean;
      status?: 'draft' | 'published';
      includeNameInKnowledge?: boolean;
      includeTaglineInKnowledge?: boolean;
      includeNotesInKnowledge: boolean;
    },
  ): Promise<{ ok: true; botId: string; status: string }> {
    const existing = await this.botModel.findById(id).select('_id type name slug').lean();
    if (!existing || (existing as { type?: string }).type !== 'showcase') {
      throw new Error('Bot not found');
    }
    const status = normalized.status === 'published' ? 'published' : 'draft';
    const finalName = normalized.name?.trim() || 'New bot';
    const description = String(normalized.description ?? '').trim();
    if (status === 'published') {
      if (!normalized.name?.trim()) throw new Error('Name is required to publish.');
      if (!description) throw new Error('Description is required to publish.');
    }
    let nextSlug = String((existing as { slug?: string }).slug ?? '');
    const shouldUpdateSlug = finalName !== String((existing as { name?: string }).name ?? '');
    if (shouldUpdateSlug) {
      nextSlug = await this.generateUniqueSlug(finalName, id);
    }

    const newFaqs = Array.isArray(normalized.faqs)
      ? (normalized.faqs as Array<{ question?: string; answer?: string; active?: boolean }>).map((f) => ({
        question: String(f?.question ?? '').trim(),
        answer: String(f?.answer ?? '').trim(),
        active: f?.active !== false,
      })).filter((f) => f.question || f.answer)
      : [];
    const newKnowledgeDescription = String(normalized.knowledgeDescription ?? '').trim();

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.botModel.findByIdAndUpdate(id, {
          name: finalName,
          slug: nextSlug,
          shortDescription: normalized.shortDescription ?? '',
          description,
          categories: normalized.categories,
          category: normalized.categories?.[0],
          imageUrl: normalized.imageUrl ?? '',
          openaiApiKeyOverride: normalized.openaiApiKeyOverride,
          whisperApiKeyOverride: normalized.whisperApiKeyOverride,
          welcomeMessage: normalized.welcomeMessage ?? '',
          exampleQuestions: normalized.exampleQuestions ?? [],
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          isPublic: normalized.isPublic,
          status,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          includeNotesInKnowledge: normalized.includeNotesInKnowledge,
        });
        await this.knowledgeBaseItemService.upsertFaqKnowledgeItemsForBot(id, newFaqs);
        await this.knowledgeBaseItemService.upsertNoteKnowledgeItemForBot(id, newKnowledgeDescription);
        await this.knowledgeBaseChunkService.replaceFaqKnowledgeChunksForBot(id);
        await this.knowledgeBaseChunkService.replaceNoteKnowledgeChunksForBot(id);
        return { ok: true, botId: id, status };
      } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, number> };
        if (!(e.code === 11000 && e.keyPattern?.slug)) throw err;
        nextSlug = await this.generateUniqueSlug(finalName, id);
      }
    }
    throw new Error('Failed to allocate unique slug.');
  }

  async update(id: string, data: Record<string, unknown>) {
    return this.botModel
      .findByIdAndUpdate(id, { $set: data }, { new: true })
      .lean();
  }

  async remove(id: string) {
    const botOid = new Types.ObjectId(id);
    const session = await this.botModel.db.startSession();
    session.startTransaction();
    try {
      // Jobs / background pipelines
      await this.ingestJobModel.deleteMany({ botId: botOid }).session(session);
      await this.summaryJobModel.deleteMany({ botId: botOid }).session(session);

      // Chat data
      await this.messageModel.deleteMany({ botId: botOid }).session(session);
      await this.conversationModel.deleteMany({ botId: botOid }).session(session);
      await this.visitorEventModel.deleteMany({ botId: botOid }).session(session);

      // RAG / knowledge data
      await this.knowledgeBaseChunkModel.deleteMany({ botId: botOid }).session(session);
      await this.knowledgeBaseItemModel.deleteMany({ botId: botOid }).session(session);
      await this.documentModel.deleteMany({ botId: botOid }).session(session);

      // Finally remove the bot itself.
      await this.botModel.deleteOne({ _id: botOid }).session(session);

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
    return { deleted: id };
  }
}
