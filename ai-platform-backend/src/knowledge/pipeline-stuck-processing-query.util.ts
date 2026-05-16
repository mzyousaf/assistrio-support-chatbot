/**
 * Mongo match fragments for KB pipeline jobs stuck in `processing`.
 * Cron + manual retry previously required `startedAt < cutoff`; jobs missing `startedAt` never matched.
 */

/** `@nestjs/mongoose` FilterQuery typing imported lazily via Record to avoid circular deps. */
export type MongoStuckCriteria = Record<string, unknown>;

/** TrainJob / scopes train jobs — {@link KnowledgeTrainingJobService.resetStuckJobs}. */
export function mongoTrainProcessingJobStaleCriteria(cutoff: Date): MongoStuckCriteria {
  return {
    status: 'processing',
    $or: [
      { startedAt: { $lt: cutoff } },
      {
        $and: [
          {
            $or: [{ startedAt: { $exists: false } }, { startedAt: null }],
          },
          { updatedAt: { $lt: cutoff } },
        ],
      },
    ],
  };
}

/** ExtractJob — {@link IngestionService.resetStuckJobs}. */
export function mongoExtractProcessingJobStaleCriteria(cutoff: Date): MongoStuckCriteria {
  return {
    status: 'processing',
    $or: [
      { startedAt: { $lt: cutoff } },
      { processingStartedAt: { $lt: cutoff } },
      {
        $and: [
          {
            $or: [{ startedAt: { $exists: false } }, { startedAt: null }],
          },
          {
            $or: [{ processingStartedAt: { $exists: false } }, { processingStartedAt: null }],
          },
          { updatedAt: { $lt: cutoff } },
        ],
      },
    ],
  };
}

/** TableImportJob — {@link TableImportService.resetStuckTableImportJobs}. */
export function mongoTableImportProcessingJobStaleCriteria(cutoff: Date): MongoStuckCriteria {
  return mongoTrainProcessingJobStaleCriteria(cutoff);
}
