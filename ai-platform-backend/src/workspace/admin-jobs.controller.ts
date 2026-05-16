import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import type { AppMode } from '../config/app-mode.util';
import { IngestionService } from '../ingestion/ingestion.service';
import { assertHttpJobProcessingAllowed } from '../ingestion/http-job-processing.guard';

@Controller('api/admin/jobs')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminJobsController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('run')
  async run(
    @Body() body: { limit?: number } | undefined,
    @Query('limit') queryLimit: string | undefined,
  ) {
    const appMode = this.config.get<AppMode>('appMode');
    const enableKbWorker = this.config.get<boolean>('enableKbWorker');
    assertHttpJobProcessingAllowed({ appMode, enableKbWorker });
    let limit: number | undefined;
    if (typeof body?.limit === 'number' && Number.isFinite(body.limit)) {
      limit = body.limit;
    } else if (queryLimit !== undefined && queryLimit !== '') {
      const n = parseInt(queryLimit, 10);
      if (Number.isFinite(n)) limit = n;
    }
    return this.ingestionService.runQueuedIngestionJobs(limit);
  }
}
