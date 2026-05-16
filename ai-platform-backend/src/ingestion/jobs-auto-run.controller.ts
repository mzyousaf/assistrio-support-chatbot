import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppMode } from '../config/app-mode.util';
import { IngestionService } from './ingestion.service';
import { assertHttpJobProcessingAllowed } from './http-job-processing.guard';

@Controller('api/jobs')
export class JobsAutoRunController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('auto-run')
  async autoRun(
    @Headers('x-job-runner-secret') headerSecret: string | undefined,
    @Body() body: { limit?: number } | undefined,
    @Query('limit') queryLimit: string | undefined,
  ) {
    const secret = typeof headerSecret === 'string' ? headerSecret.trim() : '';

    const expected = this.config.get<string>('jobRunnerSecret');
    if (!secret || secret !== expected) {
      throw new HttpException(
        { error: 'Invalid or missing job runner secret' },
        HttpStatus.UNAUTHORIZED,
      );
    }

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
    const result = await this.ingestionService.runQueuedIngestionJobs(limit);
    return result;
  }
}
