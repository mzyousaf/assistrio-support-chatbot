import { Body, Controller, Post, Query, UseGuards } from '@nestjs/common';
import { IngestionService } from '../ingestion/ingestion.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/user/jobs')
@UseGuards(AuthGuard)
export class UserJobsController {
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
