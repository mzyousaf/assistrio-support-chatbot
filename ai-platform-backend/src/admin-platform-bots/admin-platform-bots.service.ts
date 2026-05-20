import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Bot } from '../models';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { botNotDeletedClause } from '../bots/bot-not-deleted.util';
import { getDefaultBotCreatePayload } from '../workspace/shared/default-new-bot.payload';
import { generateBotAccessKey, generateBotSecretKey } from '../bots/bot-keys.util';
import { normalizeWorkspaceBotPatch } from '../workspace/shared/bot-payload';
import { exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';
import {
  isPlatformBotType,
  platformBotTypeLabel,
  type PlatformBotType,
} from '../platform-bots/platform-bot.util';

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'bot';
}

export type CreatePlatformBotBody = {
  name: string;
  description?: string;
  platformBotType: PlatformBotType;
  visibility?: 'public' | 'private';
};

export type PatchPlatformBotBody = Record<string, unknown>;

@Injectable()
export class AdminPlatformBotsService {
  constructor(
    @InjectModel(Bot.name) private readonly botModel: Model<Bot>,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  async listPlatformBots(query: { type?: string; status?: string }) {
    const filter: Record<string, unknown> = { isPlatformBot: true };
    if (isPlatformBotType(query.type)) {
      filter.platformBotType = query.type;
    }
    if (query.status === 'draft' || query.status === 'published') {
      filter.status = query.status;
    }

    const bots = await this.botModel
      .find({ $and: [filter, botNotDeletedClause()] })
      .sort({ createdAt: -1 })
      .select(
        'name status visibility isPublic createdAt _id platformBotType allowedOrigins',
      )
      .lean();

    const botIds = (bots as { _id: unknown }[]).map((b) => String(b._id));
    const statsMap = await this.botsService.getListStatsForBots(botIds);

    return (bots as Record<string, unknown>[]).map((b) => {
      const id = String(b._id);
      const stats = statsMap.get(id);
      const visibility =
        b.visibility === 'private' || b.visibility === 'public' ? b.visibility : 'public';
      return {
        _id: id,
        name: String(b.name ?? '').trim() || 'Untitled',
        platformBotType: (b.platformBotType as PlatformBotType | undefined) ?? null,
        platformBotTypeLabel: platformBotTypeLabel(b.platformBotType as PlatformBotType | undefined),
        status: b.status === 'published' ? 'published' : 'draft',
        visibility,
        isPublic: visibility !== 'private' && b.isPublic !== false,
        createdAt: (b.createdAt as Date)?.toISOString?.() ?? null,
        updatedAt: stats?.lastActivityAt ?? null,
      };
    });
  }

  async getPlatformBot(botId: string) {
    const bot = await this.findPlatformBotOrThrow(botId);
    const visibility =
      bot.visibility === 'private' || bot.visibility === 'public' ? bot.visibility : 'public';
    const allowedOrigins = Array.isArray(bot.allowedOrigins)
      ? (bot.allowedOrigins as Array<{ origin?: string; label?: string; isActive?: boolean }>).map(
          (row) => ({
            origin: String(row?.origin ?? '').trim(),
            ...(typeof row?.label === 'string' && row.label.trim() ? { label: row.label.trim() } : {}),
            isActive: row?.isActive !== false,
          }),
        ).filter((r) => r.origin)
      : [];

    return {
      _id: String((bot as { _id: unknown })._id),
      name: String(bot.name ?? '').trim() || 'Untitled',
      description: typeof bot.description === 'string' ? bot.description : '',
      shortDescription: typeof bot.shortDescription === 'string' ? bot.shortDescription : '',
      platformBotType: (bot.platformBotType as PlatformBotType | undefined) ?? null,
      platformBotTypeLabel: platformBotTypeLabel(bot.platformBotType as PlatformBotType | undefined),
      status: bot.status === 'published' ? 'published' : 'draft',
      visibility,
      isPublic: visibility !== 'private' && bot.isPublic !== false,
      slug: typeof bot.slug === 'string' ? bot.slug : '',
      accessKey: typeof bot.accessKey === 'string' ? bot.accessKey : '',
      welcomeMessage: typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage : '',
      welcomeMessageEnabled: (bot as { welcomeMessageEnabled?: boolean }).welcomeMessageEnabled !== false,
      exampleQuestions: exampleQuestionsToPublicLabels(bot.exampleQuestions),
      allowedOrigins,
      createdAt: (bot.createdAt as Date)?.toISOString?.() ?? null,
      updatedAt: null,
    };
  }

  async createPlatformBot(superadminUserId: string, body: CreatePlatformBotBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new HttpException({ error: 'Name is required' }, HttpStatus.BAD_REQUEST);
    }
    if (!isPlatformBotType(body.platformBotType)) {
      throw new HttpException({ error: 'Invalid platformBotType' }, HttpStatus.BAD_REQUEST);
    }

    const visibility = body.visibility === 'private' ? 'private' : 'public';
    const creatorOid = new Types.ObjectId(superadminUserId);
    const workspaceId = await this.workspacesService.ensurePlatformWorkspace(superadminUserId);
    const clientDraftId = `platform-${randomBytes(16).toString('hex')}`;
    const slug = await this.botsService.generateUniqueSlug(slugify(name));
    const defaults = getDefaultBotCreatePayload(slug, clientDraftId);
    const description =
      typeof body.description === 'string' && body.description.trim()
        ? body.description.trim()
        : defaults.description;

    const created = await this.botsService.create({
      ...(defaults as unknown as Record<string, unknown>),
      name,
      slug,
      clientDraftId,
      description,
      shortDescription: description.slice(0, 200),
      status: 'draft',
      visibility,
      isPublic: visibility === 'public',
      isPlatformBot: true,
      platformBotType: body.platformBotType,
      workspaceId,
      ownerId: creatorOid,
      createdByUserId: creatorOid,
      accessKey: generateBotAccessKey(),
      secretKey: generateBotSecretKey(),
    });

    return this.getPlatformBot(String((created as { _id: unknown })._id));
  }

  async patchPlatformBot(botId: string, body: PatchPlatformBotBody) {
    await this.findPlatformBotOrThrow(botId);

    let patch;
    try {
      patch = normalizeWorkspaceBotPatch(body);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      const normMsg = e instanceof Error ? e.message : String(e);
      throw new HttpException({ error: normMsg || 'Invalid payload' }, HttpStatus.BAD_REQUEST);
    }

    if (patch.touched.size > 0) {
      await this.botsService.updateWorkspaceBot(botId, patch);
    }

    const extra: Record<string, unknown> = {};
    if (body.platformBotType !== undefined) {
      if (!isPlatformBotType(body.platformBotType)) {
        throw new HttpException({ error: 'Invalid platformBotType' }, HttpStatus.BAD_REQUEST);
      }
      extra.platformBotType = body.platformBotType;
    }
    if (Object.keys(extra).length > 0) {
      await this.botModel.updateOne(
        { $and: [{ _id: new Types.ObjectId(botId) }, { isPlatformBot: true }, botNotDeletedClause()] },
        { $set: extra },
      );
    }

    return this.getPlatformBot(botId);
  }

  async deletePlatformBot(botId: string) {
    await this.findPlatformBotOrThrow(botId);
    await this.botsService.remove(botId);
    return { ok: true, deleted: botId };
  }

  private async findPlatformBotOrThrow(botId: string): Promise<Record<string, unknown>> {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid bot id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botModel
      .findOne({
        $and: [{ _id: new Types.ObjectId(botId) }, { isPlatformBot: true }, botNotDeletedClause()],
      })
      .lean();
    if (!bot) {
      throw new HttpException(
        { error: 'Platform bot not found', errorCode: 'platform_bot_not_found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return bot as Record<string, unknown>;
  }
}
