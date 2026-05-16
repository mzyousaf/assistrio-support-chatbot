import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** File → text extraction phase for document KB items (before chunk/embed). */
export type ExtractJobStatus = 'queued' | 'processing' | 'done' | 'failed';

@Schema({ timestamps: true, collection: 'content_extraction_jobs' })
export class ExtractJob {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  /** Canonical target — KnowledgeBaseItem with `sourceType=document`. */
  @Prop({ type: Types.ObjectId, ref: 'KnowledgeBaseItem', sparse: true })
  knowledgeBaseItemId?: Types.ObjectId;
  @Prop({
    required: true,
    enum: ['queued', 'processing', 'done', 'failed'],
  })
  status: ExtractJobStatus;
  @Prop()
  error?: string;
  @Prop()
  startedAt?: Date;
  @Prop()
  processingStartedAt?: Date;
  @Prop()
  finishedAt?: Date;

  @Prop()
  queuedAt?: Date;
  @Prop()
  runAfter?: Date;

  /** How many automatic failed→queued requeues the cron performed (see EXTRACT_JOB_MAX_AUTO_RETRIES in `global.constants.ts`). */
  @Prop({ default: 0, min: 0 })
  extractAutoRetryCycles?: number;

  /** Auto stuck recoveries (processing→queued); capped in `global.constants.ts`. */
  @Prop({ default: 0, min: 0 })
  extractStuckRecoveryCycles?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ExtractJobSchema = SchemaFactory.createForClass(ExtractJob);

export const EXTRACT_JOB_MONGO_COLLECTION = ExtractJobSchema.get('collection') || 'content_extraction_jobs';

ExtractJobSchema.index({ botId: 1 });
ExtractJobSchema.index({ status: 1 });
ExtractJobSchema.index({ status: 1, createdAt: 1 });
ExtractJobSchema.index({ botId: 1, createdAt: -1 });
/**
 * At most one extract job **document** per document KB route (`knowledgeBaseItemId`), all statuses.
 * The app reuses that row (queued → processing → done/failed) instead of inserting another after `done`.
 * If index build fails on existing data, dedupe duplicate `(botId, knowledgeBaseItemId)` rows (any status), then rebuild.
 * @see `docs/extract-job-dedupe-before-unique-index.md`
 */
ExtractJobSchema.index(
  { botId: 1, knowledgeBaseItemId: 1 },
  {
    unique: true,
    name: 'botId_1_knowledgeBaseItemId_1_document_extract_unique',
    partialFilterExpression: {
      knowledgeBaseItemId: { $exists: true, $type: 'objectId' },
    },
  },
);
ExtractJobSchema.index({ status: 1, runAfter: 1, createdAt: 1 });
