import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Source type for unified knowledge items (document, faq, note, url, html, table). */
export const KNOWLEDGE_BASE_ITEM_SOURCE_TYPES = [
  'document',
  'faq',
  'note',
  'url',
  'html',
  'table',
  'suggestion',
] as const;
export type KnowledgeBaseItemSourceType = (typeof KNOWLEDGE_BASE_ITEM_SOURCE_TYPES)[number];

/**
 * Training lifecycle for a KB item (stored in `status` for backward compatibility with indexes and RAG).
 */
export const KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES = [
  'pending',
  'queued',
  'processing',
  'ready',
  'failed',
] as const;
export type KnowledgeBaseItemTrainingStatus = (typeof KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES)[number];
/** @deprecated Use KnowledgeBaseItemTrainingStatus; kept as alias. */
export type KnowledgeBaseItemStatus = KnowledgeBaseItemTrainingStatus;

/** Text extraction lifecycle for KB items (documents only; FAQ/note/table/suggestion use `not_required`). */
export const KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES = [
  'not_required',
  'waiting_for_source',
  'queued',
  'processing',
  'done',
  'failed',
] as const;
export type KnowledgeBaseItemExtractionStatus = (typeof KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES)[number];

/** File / HTTPS URL payload for document KB rows (`fileMeta`). No raw bytes in Mongo. */
@Schema({ _id: false })
export class KnowledgeBaseItemFileMeta {
  @Prop()
  originalName?: string;
  @Prop()
  mimeType?: string;
  @Prop({ min: 0 })
  sizeBytes?: number;
  @Prop()
  storageKey?: string;
  @Prop()
  storageBucket?: string;
  /** e.g. `s3` — reserved for future backends */
  @Prop()
  storageProvider?: string;
  @Prop({ enum: ['uploaded', 'upload_failed'] })
  uploadStatus?: 'uploaded' | 'upload_failed';
  /** HTTPS document source — mutually exclusive with S3 bucket/key for extraction. */
  @Prop()
  url?: string;
  @Prop()
  uploadSessionId?: string;
  /** e.g. `s3` | `https` */
  @Prop()
  storage?: string;
}

/**
 * Rarely populated; prefer `content` plus document `fileMeta.url` when relevant.
 */
@Schema({ _id: false })
export class KnowledgeBaseItemSourceGeneric {
  @Prop()
  url?: string;
  @Prop()
  html?: string;
  @Prop()
  crawlId?: string;
}

@Schema({ _id: false })
export class KnowledgeBaseItemFaqMeta {
  /** Q&A group title (optional; legacy rows may omit). */
  @Prop()
  title?: string;
  /** Phrasing variants (first element is primary). */
  @Prop({ type: [String], default: undefined })
  questions?: string[];
  @Prop()
  answer?: string;
  @Prop()
  faqIndex?: number;
}

@Schema({ _id: false })
export class KnowledgeBaseItemNoteMeta {
  /** `snippet` = titled snippet; `general_note` = legacy single note blob. */
  @Prop()
  kind?: string;
  @Prop()
  snippetIndex?: number;
}

@Schema({ _id: false })
export class KnowledgeBaseItemTableMeta {
  @Prop()
  tableIndex?: number;
  /** Imported datasheet file display (optional). */
  @Prop()
  importFileName?: string;
  @Prop({ min: 0 })
  importFileSize?: number;
  /**
   * Async CSV/XLSX import lifecycle (never document extraction).
   * When absent or `complete`, the table grid is ready for training display rules.
   */
  @Prop({
    enum: ['import_queued', 'importing', 'import_failed', 'complete'],
  })
  importPhase?: 'import_queued' | 'importing' | 'import_failed' | 'complete';
  @Prop()
  importError?: string;
  @Prop()
  importErrorCode?: string;
  @Prop({ type: Types.ObjectId, ref: 'TableImportJob' })
  tableImportJobId?: Types.ObjectId;
  @Prop()
  importedAt?: Date;
  @Prop({ min: 0 })
  rowCount?: number;
  @Prop({ min: 0 })
  columnCount?: number;
}

@Schema({ _id: false })
export class KnowledgeBaseItemSuggestionMeta {
  /** Index aligned with `exampleQuestions` / widget chips. */
  @Prop()
  suggestionIndex?: number;
  @Prop()
  chipText?: string;
  /**
   * Trainable scoped text (widget `context`). When absent on the chip, suggestion sync does not persist a KB row
   * for that chip (label-only = UI-only — no chunks, no retrieval stats inflation).
   */
  @Prop()
  scopedInformation?: string;
  @Prop()
  displayOrder?: number;
}

@Schema({ timestamps: true, collection: 'knowledge_base_items' })
export class KnowledgeBaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Bot', required: true })
  botId: Types.ObjectId;
  title: string;
  @Prop({
    required: true,
    enum: KNOWLEDGE_BASE_ITEM_SOURCE_TYPES,
  })
  sourceType: KnowledgeBaseItemSourceType;
  @Prop({
    enum: KNOWLEDGE_BASE_ITEM_TRAINING_STATUSES,
    default: 'pending',
  })
  status: KnowledgeBaseItemTrainingStatus;
  /**
   * File → text extraction lifecycle (`sourceType=document`). Non-document rows use `not_required`.
   * Do not overload {@link status} with extraction phases.
   */
  @Prop({
    enum: KNOWLEDGE_BASE_ITEM_EXTRACTION_STATUSES,
  })
  extractionStatus?: KnowledgeBaseItemExtractionStatus;
  /** User- or system-facing extraction failure (distinct from `trainingError`). */
  @Prop()
  extractionError?: string;
  @Prop({ default: true })
  active: boolean;
  /** Structured file / URL info for `sourceType === 'document'`. */
  @Prop({ type: KnowledgeBaseItemFileMeta })
  fileMeta?: KnowledgeBaseItemFileMeta;
  @Prop({ type: KnowledgeBaseItemSourceGeneric })
  source?: KnowledgeBaseItemSourceGeneric;
  @Prop({ default: '' })
  content: string;
  /** Structured payload (e.g. datasheet JSON). Distinct from `content` — not redundant. */
  @Prop()
  rawContent?: string;
  /** User-facing failure text when training (`status === 'failed'`). */
  @Prop()
  trainingError?: string;
  @Prop()
  contentHash?: string;
  /** When embeddable text last changed in a way that consumers care about. */
  @Prop()
  lastContentUpdatedAt?: Date;
  @Prop()
  lastQueuedAt?: Date;
  @Prop()
  runAfter?: Date;
  @Prop()
  lastTrainingStartedAt?: Date;
  /** Completion time after successful embedding. */
  @Prop()
  lastTrainedAt?: Date;
  @Prop({ type: Number, min: 0 })
  characterCount?: number;
  /**
   * Document uploads: true once non-empty trainable text has been persisted on this KB item
   * (file extraction, URL fetch, or manual body). False while waiting for ingestion extraction.
   */
  @Prop({ default: false })
  isContentExtracted?: boolean;
  /** When non-empty trainable document text was last produced by extraction (or inline body). */
  @Prop()
  extractedAt?: Date;
  /** @deprecated Prefer {@link extractedAt}; retained for older readers. */
  @Prop()
  lastExtractedAt?: Date;
  @Prop({ type: KnowledgeBaseItemFaqMeta })
  faqMeta?: KnowledgeBaseItemFaqMeta;
  @Prop({ type: KnowledgeBaseItemNoteMeta })
  noteMeta?: KnowledgeBaseItemNoteMeta;
  @Prop({ type: KnowledgeBaseItemTableMeta })
  tableMeta?: KnowledgeBaseItemTableMeta;
  @Prop({ type: KnowledgeBaseItemSuggestionMeta })
  suggestionMeta?: KnowledgeBaseItemSuggestionMeta;
  /**
   * Customer POST `/knowledge/items/:id/retry` reservations that completed without handler error
   * (see {@link KNOWLEDGE_MANUAL_RETRY_MAX_PER_ITEM} in `global.constants.ts`).
   */
  @Prop({ default: 0, min: 0 })
  knowledgeManualRetryCount?: number;

  /**
   * User delete timestamp — item stays in DB until the knowledge-item purge cron hard-deletes after grace.
   * Queries use {@link knowledgeItemNotDeletedClause}.
   */
  @Prop()
  deletedAt?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const KnowledgeBaseItemSchema = SchemaFactory.createForClass(KnowledgeBaseItem);
KnowledgeBaseItemSchema.index({ botId: 1 });
KnowledgeBaseItemSchema.index({ status: 1 });
KnowledgeBaseItemSchema.index({ botId: 1, status: 1, createdAt: -1 });
KnowledgeBaseItemSchema.index({ botId: 1, sourceType: 1, createdAt: -1 });
/**
 * Status APIs and training pipeline scans commonly filter by bot + source type + lifecycle status
 * (queued/processing/failed) and then read newest rows.
 */
KnowledgeBaseItemSchema.index({ botId: 1, sourceType: 1, status: 1, createdAt: -1 });
KnowledgeBaseItemSchema.index({ botId: 1, active: 1, status: 1 });
KnowledgeBaseItemSchema.index({ botId: 1, extractionStatus: 1 });
KnowledgeBaseItemSchema.index({ botId: 1, active: 1, deletedAt: 1 });
KnowledgeBaseItemSchema.index({ deletedAt: 1, active: 1 });
