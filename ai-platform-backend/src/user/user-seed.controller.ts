import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { USER_ROLES, type UserRole } from '../models';
import { SHOWCASE_BOTS } from './showcase-bots-seed.data';
import { AuthService } from '../auth/auth.service';
import { AuthGuard, type RequestUser } from '../auth/auth.guard';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/user/seed')
export class UserSeedController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
    private readonly ingestionService: IngestionService,
    private readonly authService: AuthService,
  ) { }

  @Post()
  async seedUser(@Body() body: { email?: string; password?: string; role?: string }) {
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const roleInput = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : 'admin';
    const role: UserRole = (USER_ROLES as readonly string[]).includes(roleInput) ? (roleInput as UserRole) : 'admin';
    try {
      const user = await this.authService.createUser(email, password, role);
      return {
        ok: true,
        message: 'User created.',
        email: (user as unknown as { email?: string }).email,
        role,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      const status =
        message === 'User with this email already exists'
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;
      throw new HttpException({ error: message }, status);
    }
  }

  @Post('showcase-bots')
  @UseGuards(AuthGuard)
  async seedShowcaseBots(@Req() req: RequestWithUser) {
    try {
      const createdByUserId =
        req.user?._id != null && Types.ObjectId.isValid(String(req.user._id))
          ? new Types.ObjectId(String(req.user._id))
          : undefined;
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
          ...(createdByUserId ? { createdByUserId } : {}),
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
      throw new HttpException({ error: 'Internal server error' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
