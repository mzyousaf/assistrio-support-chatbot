import { Controller, Post, Headers, Body } from '@nestjs/common';
import { IngestionService } from './ingestion.service';

@Controller('api/jobs')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) { }

  @Post('run')
  async run(
    @Headers('x-job-runner-secret') secret: string,
    @Body() body: { jobId?: string },
  ) {
    return this.ingestionService.runJob(secret, body.jobId);
  }
}
