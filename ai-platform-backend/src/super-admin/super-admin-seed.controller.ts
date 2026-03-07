import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { SHOWCASE_BOTS } from './showcase-bots-seed.data';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/super-admin/seed')
export class SuperAdminSeedController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly authService: SuperAdminAuthService,
  ) {}

  /**
   * Create the first super-admin. No auth required. Only works when zero super-admins exist.
   * Body: { email: string, password: string }
   */
  @Post()
  async seedSuperAdmin(@Body() body: { email?: string; password?: string }) {
    const count = await this.authService.countSuperAdmins();
    if (count > 0) {
      throw new HttpException(
        { error: 'Super admin already exists. Use login instead.' },
        HttpStatus.CONFLICT,
      );
    }
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    try {
      const user = await this.authService.createSuperAdmin(email, password);
      return {
        ok: true,
        message: 'Super admin created.',
        email: (user as { email?: string }).email,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create super admin';
      throw new HttpException({ error: message }, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('showcase-bots')
  @UseGuards(SuperAdminGuard)
  async seedShowcaseBots() {
    try {
      const createdBots: { botId: string; slug: string; docsQueued: number }[] = [];
      const skippedBots: { slug: string; reason: string }[] = [];

      for (const seed of SHOWCASE_BOTS) {
        const existing = await this.botsService.findOneBySlug(seed.slug);
        if (existing) {
          skippedBots.push({ slug: seed.slug, reason: 'already_exists' });
          continue;
        }

        const bot = await this.botsService.create({
          name: seed.name,
          slug: seed.slug,
          type: 'showcase',
          status: 'published',
          isPublic: true,
          shortDescription: seed.shortDescription,
          description: seed.description,
          welcomeMessage: seed.welcomeMessage,
          exampleQuestions: seed.exampleQuestions,
          personality: seed.personality,
          chatUI: {
            primaryColor: '#14B8A6',
            backgroundStyle: 'light',
            bubbleBorderRadius: 20,
            launcherPosition: 'bottom-right',
            timePosition: 'top',
            showBranding: true,
          },
          config: { temperature: 0.3, responseLength: 'medium', maxTokens: 512 },
          leadCapture: { enabled: false, fields: [] },
          faqs: [],
          categories: [],
        });

        const botId = (bot as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((bot as { _id?: unknown })._id);
        let docsQueued = 0;

        for (const docSeed of seed.docs) {
          const doc = await this.documentsService.create({
            botId,
            title: docSeed.title,
            sourceType: 'manual',
            status: 'queued',
            text: docSeed.text,
          });
          const docId = (doc as { _id?: { toString?: () => string } })._id?.toString?.() ?? String((doc as { _id?: unknown })._id);
          await this.ingestionService.createQueuedJob(botId, docId);
          docsQueued += 1;
        }

        createdBots.push({ botId, slug: seed.slug, docsQueued });
      }

      return { ok: true, createdBots, skippedBots };
    } catch (err) {
      console.error('Seed showcase bots failed', err);
      throw new HttpException(
        { error: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
