export interface IngestionRunResult {
  ok: true;
  processed: number;
  processedCount: number;
  failed: number;
  claimedJobId?: string;
  finalDocStatus?: 'ready' | 'failed';
  results: Array<{
    jobId: string;
    docId: string;
    status: 'done' | 'skipped' | 'failed';
    error?: string;
  }>;
}
