import { Body, Controller, Get, Delete, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { DocumentsService } from '../documents/documents.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/user/bots/:botId/documents')
@UseGuards(AuthGuard)
export class UserDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  async list(
    @Param('botId') botId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
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
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }

  @Patch(':id')
  async setActive(
    @Param('botId') botId: string,
    @Param('id') id: string,
    @Body() body: { active?: boolean },
  ) {
    await this.documentsService.setActive(botId, id, body?.active !== false);
    return { ok: true };
  }
}
