import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { IngestionService } from '../ingestion/ingestion.service';

@Controller('api/admin/jobs')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminJobsController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('run')
  async run(
    @Body() body: { limit?: number } | undefined,
    @Query('limit') queryLimit: string | undefined,
  ) {
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
