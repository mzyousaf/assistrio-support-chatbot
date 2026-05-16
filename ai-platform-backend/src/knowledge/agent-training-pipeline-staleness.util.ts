/**
 * GET `/knowledge/training/status` presentation-only staleness: rows stuck with no Mongo activity
 * for {@link DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES} do not inflate extracting/import/training flags.
 */

import type { PipelineStage } from 'mongoose';

/** Default stale window when `AGENT_TRAINING_PIPELINE_STALE_MINUTES` is unset. */
export const DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES = 30;

/** Resolve cutoff instant — KB rows with no touches after this are ignored for pipeline-active buckets on agent status. */
export function pipelineTouchCutoffFromStaleMinutes(now: Date, staleMinutes: number): Date {
  const m = Number(staleMinutes);
  const safe = Number.isFinite(m) && m >= 1 ? Math.min(Math.floor(m), 24 * 60) : DEFAULT_AGENT_TRAINING_PIPELINE_STALE_MINUTES;
  return new Date(now.getTime() - safe * 60_000);
}

/** Mongo filter: row touched recently enough to count toward pipeline-active aggregates on agent training/status. */
export function kbPipelineActivityFreshMongoClause(cutoff: Date): Record<string, unknown> {
  return {
    $or: [
      { updatedAt: { $gte: cutoff } },
      { lastTrainingStartedAt: { $gte: cutoff } },
      { lastQueuedAt: { $gte: cutoff } },
      { extractedAt: { $gte: cutoff } },
    ],
  };
}

/** Aggregation stages: due/processing training pipeline counts require a touch ≥ cutoff (agent training/status only). */
export function kbLifecycleAggregateFreshPipelineStages(pipelineTouchCutoff: Date): PipelineStage[] {
  const epochLit = { $literal: new Date(0) };
  const cutoffLit = { $literal: pipelineTouchCutoff };
  return [
    {
      $addFields: {
        kbPipelineTouchTs: {
          $max: [
            { $ifNull: ['$updatedAt', epochLit] },
            { $ifNull: ['$lastTrainingStartedAt', epochLit] },
            { $ifNull: ['$lastQueuedAt', epochLit] },
            { $ifNull: ['$extractedAt', epochLit] },
          ],
        },
      },
    },
    {
      $addFields: {
        kbPipelineFreshEnough: { $gte: ['$kbPipelineTouchTs', cutoffLit] },
      },
    },
    {
      $addFields: {
        dueQueuedFlag: { $and: ['$dueQueuedFlag', '$kbPipelineFreshEnough'] },
        processingFlag: { $and: ['$processingFlag', '$kbPipelineFreshEnough'] },
      },
    },
  ];
}
