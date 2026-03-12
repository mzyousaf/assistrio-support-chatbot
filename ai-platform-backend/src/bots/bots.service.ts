import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bot } from '../models';
import { getDefaultBotCreatePayload } from '../super-admin/default-new-bot.payload';
import { FaqNoteEmbeddingJobService } from '../embedding/faq-note-embedding-job.service';
import {
  mergeFaqsForSave,
  getNoteEmbeddingStateForSave,
} from '../embedding/faq-note-embedding.helper';
import type { FaqWithEmbeddingMeta } from '../embedding/faq-note-embedding.helper';

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
    private readonly faqNoteEmbeddingJobService: FaqNoteEmbeddingJobService,
  ) {}

  async findAll() {
    return this.botModel.find().lean();
  }

  /** List bots for super-admin with optional status filter (showcase only). */
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

  /** Find showcase bot by slug for chat (returns BotLike shape with knowledge + lead capture). */
  async findOneBySlugForChat(slug: string) {
    return this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'showcase' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage knowledgeDescription leadCapture personality config faqs type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
  }

  /** Find visitor-own bot by slug for chat. */
  async findOneBySlugTrial(slug: string) {
    return this.botModel
      .findOne({ slug: slug.trim().toLowerCase(), type: 'visitor-own' })
      .select('_id slug name shortDescription description category openaiApiKeyOverride welcomeMessage knowledgeDescription leadCapture personality config faqs type limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
  }

  /** Find one bot by slug for demo/trial page (public shape for chat UI). */
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
      .select('_id slug name shortDescription avatarEmoji imageUrl welcomeMessage chatUI faqs exampleQuestions')
      .lean();
    if (!doc) return null;
    const b = doc as Record<string, unknown>;
    const welcomeMsg = typeof b.welcomeMessage === 'string' && b.welcomeMessage.trim() ? b.welcomeMessage.trim() : undefined;
    return {
      id: String(b._id),
      slug: String(b.slug ?? ''),
      name: String(b.name ?? ''),
      shortDescription: String(b.shortDescription ?? ''),
      avatarEmoji: String(b.avatarEmoji ?? '💬'),
      imageUrl: String(b.imageUrl ?? ''),
      welcomeMessage: welcomeMsg,
      chatUI: b.chatUI as unknown,
      faqs: Array.isArray(b.faqs)
        ? (b.faqs as Array<{ question?: unknown; answer?: unknown }>).map((faq) => ({
            question: String(faq?.question ?? '').trim(),
            answer: String(faq?.answer ?? '').trim(),
          }))
        : [],
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

  /** Find showcase bot for super-admin GET (selected fields only). */
  async findOneShowcaseForAdmin(id: string) {
    return this.botModel
      .findById(id)
      .select('slug name shortDescription description category categories imageUrl openaiApiKeyOverride whisperApiKeyOverride welcomeMessage knowledgeDescription status isPublic leadCapture chatUI faqs exampleQuestions personality type config limitOverrideMessages includeNameInKnowledge includeTaglineInKnowledge')
      .lean();
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
              knowledgeDescription: normalized.knowledgeDescription,
              leadCapture: normalized.leadCapture,
              chatUI: normalized.chatUI,
              faqs: normalized.faqs,
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
            },
          );
          return { botId: String((existing as { _id: unknown })._id), slug: finalSlug };
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
          knowledgeDescription: normalized.knowledgeDescription,
          leadCapture: normalized.leadCapture,
          chatUI: normalized.chatUI,
          faqs: normalized.faqs,
          exampleQuestions: normalized.exampleQuestions ?? [],
          personality: normalized.personality,
          config: normalized.config,
          limitOverrideMessages: normalized.limitOverrideMessages,
          type: 'showcase',
          status: 'published',
          isPublic: normalized.isPublic,
          includeNameInKnowledge: normalized.includeNameInKnowledge,
          includeTaglineInKnowledge: normalized.includeTaglineInKnowledge,
          createdAt: new Date(),
        });
        return { botId: String((created as { _id: unknown })._id), slug: (created as { slug: string }).slug };
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
    },
  ): Promise<{ ok: true; botId: string; status: string; embeddingQueued?: boolean }> {
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
      ? (normalized.faqs as Array<{ question?: string; answer?: string }>).map((f) => ({
          question: String(f?.question ?? '').trim(),
          answer: String(f?.answer ?? '').trim(),
        })).filter((f) => f.question || f.answer)
      : [];
    const newKnowledgeDescription = String(normalized.knowledgeDescription ?? '').trim();

    const currentForMerge = await this.botModel
      .findById(id)
      .select('faqs knowledgeDescription noteEmbeddingStatus noteEmbeddingInputHash')
      .select('+faqs.embedding')
      .lean();
    const currentFaqs = (currentForMerge as { faqs?: FaqWithEmbeddingMeta[] } | null)?.faqs;
    const mergedFaqs = mergeFaqsForSave(currentFaqs, newFaqs);
    const currentNoteHash = (currentForMerge as { noteEmbeddingInputHash?: string } | null)?.noteEmbeddingInputHash;
    const currentNoteStatus = (currentForMerge as { noteEmbeddingStatus?: 'pending' | 'ready' | 'failed' } | null)?.noteEmbeddingStatus;
    const noteState = getNoteEmbeddingStateForSave(currentNoteHash, currentNoteStatus, newKnowledgeDescription);

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
          knowledgeDescription: newKnowledgeDescription,
          faqs: mergedFaqs,
          noteEmbeddingInputHash: noteState.noteEmbeddingInputHash,
          noteEmbeddingStatus: noteState.noteEmbeddingStatus,
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
        });
        const { faqCount, noteCount } = await this.faqNoteEmbeddingJobService.enqueueForBot(id);
        return { ok: true, botId: id, status, embeddingQueued: faqCount + noteCount > 0 };
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
    await this.botModel.findByIdAndDelete(id);
    return { deleted: id };
  }
}
