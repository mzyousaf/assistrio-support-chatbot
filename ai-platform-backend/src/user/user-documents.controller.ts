import {
  Body,
  Controller,
  Get,
  Delete,
  Param,
  Patch,
  UseGuards,
  Query,
  Req,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { DocumentsService } from '../documents/documents.service';
import { BotsService } from '../bots/bots.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthGuard, type RequestUser } from '../auth/auth.guard';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/user/bots/:botId/documents')
@UseGuards(AuthGuard)
export class UserDocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
  ) {}

  private async assertBotAccess(botId: string, req: RequestWithUser): Promise<void> {
    const bot = await this.botsService.findOne(botId);
    if (!bot || (bot as { type?: string }).type !== 'showcase') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessShowcaseBot(
      uid,
      req.user?.role ?? 'customer',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
  }

  @Get()
  async list(
    @Param('botId') botId: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.assertBotAccess(botId, req);
    const safePage = Math.max(1, Number(page ?? 1) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit ?? 10) || 10));

    const [{ documents, total }, health] = await Promise.all([
      this.documentsService.findByBotPaginated(botId, safePage, safeLimit),
      this.documentsService.getHealthSummary(botId),
    ]);

    return {
      documents,
      total,
      counts: {
        total: health.docsTotal ?? 0,
        queued: health.docsQueued ?? 0,
        processing: health.docsProcessing ?? 0,
        ready: health.docsReady ?? 0,
        failed: health.docsFailed ?? 0,
      },
      lastIngestedAt: health.lastIngestedAt,
      lastFailedDoc: health.lastFailedDoc,
    };
  }

  @Delete(':id')
  async remove(@Param('botId') botId: string, @Param('id') id: string, @Req() req: RequestWithUser) {
    await this.assertBotAccess(botId, req);
    return this.documentsService.remove(id);
  }

  @Patch(':id')
  async setActive(
    @Param('botId') botId: string,
    @Param('id') id: string,
    @Body() body: { active?: boolean },
    @Req() req: RequestWithUser,
  ) {
    await this.assertBotAccess(botId, req);
    await this.documentsService.setActive(botId, id, body?.active !== false);
    return { ok: true };
  }
}
