import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import * as path from 'path';
import { AnalyticsService } from '../analytics/analytics.service';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { KbService } from '../kb/kb.service';
import { VisitorsService } from '../visitors/visitors.service';
import type { CreateTrialBotFields, ParsedFaq } from './trial-create-bot.dto';
import { parseFaqs, toSlug } from './trial-create-bot.dto';

export interface TrialFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface CreateTrialBotResult {
  ok: true;
  botId: string;
  docs: Array<{ docId: string; fileName: string; status: 'queued' }>;
  slug: string;
}

@Injectable()
export class TrialService {
  private readonly kbDirectory: string;

  constructor(
    private readonly botsService: BotsService,
    private readonly visitorsService: VisitorsService,
    private readonly analyticsService: AnalyticsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly kbService: KbService,
  ) {
    this.kbDirectory = path.join(process.cwd(), 'public', 'kb');
  }

  private async generateUniqueSlug(botName: string): Promise<string> {
    const baseSlug = toSlug(botName);
    let candidate = baseSlug;
    let attempt = 0;
    while (attempt < 5) {
      const existing = await this.botsService.findOneBySlug(candidate);
      if (!existing) return candidate;
      const suffix = Math.random().toString(36).slice(2, 8);
      candidate = `${baseSlug}-${suffix}`;
      attempt += 1;
    }
    return `${baseSlug}-${Date.now()}`;
  }

  async createTrialBot(
    fields: CreateTrialBotFields,
    files: TrialFile[],
  ): Promise<CreateTrialBotResult> {
    const { botName, email, description, visitorId, faqs } = fields;

    await this.visitorsService.getOrCreateVisitor(visitorId);
    await this.visitorsService.updateVisitorProfile(visitorId, { email });

    const parsedFaqs: ParsedFaq[] = parseFaqs(faqs);
    const slug = await this.generateUniqueSlug(botName);
    const now = new Date();

    const bot = await this.botsService.create({
      name: botName,
      slug,
      type: 'visitor-own',
      ownerVisitorId: visitorId,
      isPublic: false,
      description:
        typeof description === 'string' && description.trim().length > 0
          ? description.trim()
          : undefined,
      faqs: parsedFaqs,
      createdAt: now,
    });

    const botId = (bot as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((bot as { _id?: unknown })._id);

    await this.analyticsService.logVisitorEvent({
      visitorId,
      type: 'trial_bot_created',
      botSlug: slug,
      botId,
      metadata: { email, botName },
    });

    const docs: Array<{ docId: string; fileName: string; status: 'queued' }> = [];

    await mkdir(this.kbDirectory, { recursive: true });

    for (const file of files) {
      const extension = this.kbService.getFileExtension(file.originalname);
      const safeBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .toLowerCase()
        .replace(/[^a-z0-9-_.]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 60);
      const randomSuffix = Math.random()
        .toString(36)
        .slice(2, 10)
        .replace(/[^a-z0-9]/g, '');
      const storedName = `${Date.now()}-${randomSuffix}-${safeBase || 'file'}.${extension}`.replace(
        /[^a-z0-9-_.]/g,
        '-',
      );
      const filePath = path.join(this.kbDirectory, storedName);
      const publicUrl = `/kb/${storedName}`;

      await writeFile(filePath, file.buffer);

      const document = await this.documentsService.create({
        botId,
        title: file.originalname,
        sourceType: 'upload',
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        url: publicUrl,
      });

      const docId = (document as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((document as { _id?: unknown })._id);

      await this.ingestionService.createQueuedJob(botId, docId);

      docs.push({ docId, fileName: file.originalname, status: 'queued' });
    }

    return { ok: true, botId, docs, slug };
  }
}
