import { Controller, Post, Headers, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppMode } from '../config/app-mode.util';
import { IngestionService } from './ingestion.service';
import { assertHttpJobProcessingAllowed } from './http-job-processing.guard';

@Controller('api/jobs')
export class IngestionController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post('run')
  async run(
    @Headers('x-job-runner-secret') secret: string,
    @Body() body: { jobId?: string },
  ) {
    const appMode = this.config.get<AppMode>('appMode');
    const enableKbWorker = this.config.get<boolean>('enableKbWorker');
    assertHttpJobProcessingAllowed({ appMode, enableKbWorker });
    return this.ingestionService.runJob(secret, body.jobId);
  }
}
