import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IngestionService } from '../ingestion/ingestion.service';
import { SummaryJobService } from '../chat/summary-job.service';

const CRON_INGESTION = '[cron:ingestion]';
const CRON_SUMMARY = '[cron:summary]';

@Injectable()
export class JobsCronService {
  private ingestionRunning = false;
  private summaryRunning = false;

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly summaryJobService: SummaryJobService,
  ) {}

  /**
   * Document ingestion jobs: runs every 10 seconds.
   */
  @Cron('*/10 * * * * *')
  async runDocumentIngestionCron(): Promise<void> {
    if (this.ingestionRunning) {
      console.log(`${CRON_INGESTION} skipped (previous run still in progress)`);
      return;
    }
    this.ingestionRunning = true;
    const limitRaw = process.env.JOBS_RUNNER_LIMIT ?? '5';
    const limit = Math.max(1, Math.floor(Number(limitRaw)) || 5);
    let attempted = 0;
    let processed = 0;
    try {
      await this.ingestionService.resetStuckJobs();
      for (let i = 0; i < limit; i++) {
        const job = await this.ingestionService.claimQueuedJob();
        if (!job) break;
        attempted += 1;
        try {
          await this.ingestionService.processJob(job);
          processed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'ingestion_failed';
          await this.ingestionService.markJobFailed(job, message);
        }
      }
      if (attempted > 0) {
        console.log(`${CRON_INGESTION} run finished attempted=${attempted} processed=${processed}`);
      }
    } finally {
      this.ingestionRunning = false;
    }
  }

  /**
   * Summary jobs: runs every 10 seconds (lower priority).
   */
  @Cron('*/10 * * * * *')
  async runSummaryCron(): Promise<void> {
    if (this.summaryRunning) {
      console.log(`${CRON_SUMMARY} skipped (previous run still in progress)`);
      return;
    }
    this.summaryRunning = true;
    const limitRaw = process.env.SUMMARY_JOBS_RUNNER_LIMIT ?? '5';
    const limit = Math.max(1, Math.floor(Number(limitRaw)) || 5);
    let attempted = 0;
    let processed = 0;
    try {
      for (let i = 0; i < limit; i++) {
        const job = await this.summaryJobService.claimOne();
        if (!job) break;
        attempted += 1;
        try {
          await this.summaryJobService.processJob(job);
          processed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'summary_failed';
          await this.summaryJobService.markFailed(job, message);
        }
      }
      if (attempted > 0) {
        console.log(`${CRON_SUMMARY} run finished attempted=${attempted} processed=${processed}`);
      }
    } finally {
      this.summaryRunning = false;
    }
  }
}
