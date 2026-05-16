import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type TrainJobStatus = 'queued' | 'processing' | 'done' | 'failed';

/** Non-document KB embedding work: FAQ/Q&A, notes/snippets, spreadsheet tables. */
export const KNOWLEDGE_TRAINING_SCOPES = ['faq', 'note', 'table', 'suggestion'] as const;
export type KnowledgeTrainingScope = (typeof KNOWLEDGE_TRAINING_SCOPES)[number];

export type TrainJobKind = 'document' | 'scopes';

/**
 * Chunk → embed → ready for documents, or scope batch embedding for FAQ/note/table/suggestion.
 * Replaces legacy `knowledge_training_jobs` plus document embedding work that lived on ingest jobs.
 */
@Schema({ timestamps: true, collection: 'knowledge_base_training_jobs' })
export class TrainJob {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;

  @Prop({ required: true, enum: ['document', 'scopes'] })
  kind: TrainJobKind;

  /** Document KB route id when `kind === 'document'`. */
  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBaseItem', sparse: true })
  knowledgeBaseItemId?: Types.ObjectId;

  /** When `kind === 'scopes'`: scopes to process (faq → note → table → suggestion). */
  @Prop({ type: [String], sparse: true })
  scopes?: KnowledgeTrainingScope[];

  @Prop({
    required: true,
    enum: ['queued', 'processing', 'done', 'failed'],
  })
  status: TrainJobStatus;

  @Prop()
  error?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop()
  queuedAt?: Date;

  @Prop()
  runAfter?: Date;

  /**
   * Scopes jobs only: when true, move every `queued` row in scope to `processing` even if `runAfter`
   * is still in the future (manual / test `immediateJob`). Auto-train jobs leave this false so
   * per-item delays are enforced in {@link KnowledgeTrainingJobService.markScopeQueuedToProcessing}.
   */
  @Prop()
  skipRunAfterItemGate?: boolean;

  @Prop({ default: 0, min: 0 })
  queuedItems: number;

  @Prop({ default: 0, min: 0 })
  queuedCharacters: number;

  @Prop()
  estimatedTrainingSeconds?: number;

  /** Snapshot of `KnowledgeBaseItem.contentHash` when this job was queued (debug / stale diagnostics). */
  @Prop()
  documentEmbedTargetContentHash?: string;

  /** Snapshot of `KnowledgeBaseItem.lastContentUpdatedAt` when this job was queued. */
  @Prop()
  documentEmbedTargetLastContentUpdatedAt?: Date;

  /** Auto stuck recoveries (processing→queued); capped in `global.constants.ts`. */
  @Prop({ default: 0, min: 0 })
  trainStuckRecoveryCycles?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const TrainJobSchema = SchemaFactory.createForClass(TrainJob);

export const TRAIN_JOB_MONGO_COLLECTION = TrainJobSchema.get('collection') || 'knowledge_base_training_jobs';

TrainJobSchema.index({ botId: 1 });
TrainJobSchema.index({ status: 1 });
TrainJobSchema.index({ kind: 1, status: 1, runAfter: 1, createdAt: 1 });
/**
 * Global due-queue claim path (`status: queued` + due `runAfter`) sorts by runAfter/createdAt
 * without constraining `kind` (fallback claim after document-first pass).
 */
TrainJobSchema.index({ status: 1, runAfter: 1, createdAt: 1 });
/**
 * Document training read path: latest train job by document route (customer status enrichment,
 * manual retry/stuck reset helpers, and dedupe-safe latest-row lookups).
 */
TrainJobSchema.index({ botId: 1, kind: 1, knowledgeBaseItemId: 1, createdAt: -1 });
TrainJobSchema.index({ status: 1, createdAt: 1 });
TrainJobSchema.index({ botId: 1, createdAt: -1 });
