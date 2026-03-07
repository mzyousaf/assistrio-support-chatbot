import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from '../ingestion/ingestion.service';

@Injectable()
export class JobsCronService {
  constructor(private readonly ingestionService: IngestionService) { }

  /**
   * Every minute: claim up to JOBS_RUNNER_LIMIT queued jobs (default 5), process each, log summary.
   */
  @Cron('*/1 * * * *')
  async runCron(): Promise<void> {
    const raw = process.env.JOBS_RUNNER_LIMIT ?? '5';
    const limit = Math.max(1, Math.floor(Number(raw)) || 5);

    let processed = 0;

    for (let i = 0; i < limit; i++) {
      const job = await this.ingestionService.claimQueuedJob();
      if (!job) break;

      try {
        await this.ingestionService.processJob(job);
        processed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ingestion_failed';
        await this.ingestionService.markJobFailed(job, message);
      }
    }

    console.log(`[cron] processed=${processed}`);
  }
}
