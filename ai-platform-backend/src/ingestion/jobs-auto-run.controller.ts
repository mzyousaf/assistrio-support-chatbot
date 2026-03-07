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
import { IngestionService } from './ingestion.service';

@Controller('api/jobs')
export class JobsAutoRunController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('auto-run')
  async autoRun(
    @Headers('x-job-runner-secret') headerSecret: string | undefined,
    @Query('secret') querySecret: string | undefined,
    @Body() body: { limit?: number } | undefined,
    @Query('limit') queryLimit: string | undefined,
  ) {
    const secret =
      (typeof headerSecret === 'string' && headerSecret.trim()) ||
      (typeof querySecret === 'string' && querySecret.trim()) ||
      '';

    const expected = this.config.get<string>('jobRunnerSecret');
    if (!secret || secret !== expected) {
      throw new HttpException(
        { error: 'Invalid or missing job runner secret' },
        HttpStatus.UNAUTHORIZED,
      );
    }

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
