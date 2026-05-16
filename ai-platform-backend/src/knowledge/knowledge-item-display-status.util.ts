import type { KnowledgeBaseItemTrainingStatus } from '../models/knowledge-base-item.schema';
import type { KnowledgeBaseItemExtractionStatus } from '../models/knowledge-base-item.schema';
import { normalizeKnowledgeTrainingStatus } from './knowledge-training-status.util';
import { normalizeKnowledgeExtractionStatus, inferDocumentKnowledgeExtractionStatusFromRow } from './knowledge-extraction-status.util';
import {
  knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal,
  PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE,
} from './bot-knowledge-total-limit.service';

/** Internal pipeline phase before customer API mapping (`GET …/knowledge/status`, ingestion reconcilers). */
export type KnowledgeItemWorkflowDisplayStatus =
  | 'uploading'
  | 'waiting_for_source'
  | 'waiting_to_extract'
  | 'extracting_text'
  | 'extraction_failed'
  | 'waiting_for_training'
  | 'training_queued'
  | 'training'
  | 'ready'
  | 'training_failed'
  | 'import_queued'
  | 'importing_table'
  | 'import_failed'
  | 'out_of_storage';

/** Customer-facing taxonomy — shared across training/status, KB status, documents list APIs. */
export type CustomerKbItemApiDisplayStatus =
  | 'out_of_storage'
  | 'uploading'
  | 'extracting_text'
  | 'import_queued'
  | 'importing'
  | 'import_failed'
  | 'training_required'
  | 'training'
  | 'trained'
  | 'failed';

/** Full customer bundle for KB item polling / list APIs. */
export type CustomerKbItemApiDisplayBundle = {
  /** Unified customer status key (documents, datasheet import, embedding lifecycle). */
  displayStatus: CustomerKbItemApiDisplayStatus;
  displayLabel: string;
  /** Longer explanatory line — may include storage-cap copy where applicable. */
  displayMessage: string;
  /** Poll / row field — merges lifecycle (`pending`…) with import/exceptions (`import_queued`…); matches legacy UI merge hints. */
  trainingStatus: string;
  /** True while embeddings queue/processing applies (documents extracted, datasheet import idle). */
  isTraining: boolean;
  /** True while file upload/source wait or OCR/text extraction precedes embeddings. */
  isExtracting: boolean;
  /** True while datasheet import job/table phase is queued or importing. */
  isImporting: boolean;
};

const CUSTOMER_KB_DISPLAY_LABEL: Record<CustomerKbItemApiDisplayStatus, string> = {
  out_of_storage: 'Out of storage',
  uploading: 'Uploading',
  extracting_text: 'Extracting text',
  import_queued: 'Importing',
  importing: 'Importing',
  import_failed: 'Import failed',
  training_required: 'Training required',
  training: 'Training',
  trained: 'Trained',
  failed: 'Failed',
};

const WORKFLOW_EXTRACT_PHASES = new Set<KnowledgeItemWorkflowDisplayStatus>([
  'uploading',
  'waiting_for_source',
  'waiting_to_extract',
  'extracting_text',
]);

const WORKFLOW_IMPORT_PHASES = new Set<KnowledgeItemWorkflowDisplayStatus>(['import_queued', 'importing_table']);

export function knowledgeItemWorkflowDisplayMessage(status: KnowledgeItemWorkflowDisplayStatus): string {
  switch (status) {
    case 'uploading':
      return 'Uploading…';
    case 'waiting_for_source':
      return 'Waiting for file upload or source URL…';
    case 'waiting_to_extract':
      return 'Queued for text extraction…';
    case 'extracting_text':
      return 'Extracting text from document…';
    case 'extraction_failed':
      return 'Text extraction failed';
    case 'waiting_for_training':
      return 'Waiting for training…';
    case 'training_queued':
      return 'Training Queued…';
    case 'training':
      return 'Training…';
    case 'ready':
      return 'Ready';
    case 'training_failed':
      return 'Training failed';
    case 'import_queued':
      return 'Importing…';
    case 'importing_table':
      return 'Importing table…';
    case 'import_failed':
      return 'Import failed';
    case 'out_of_storage':
      return PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE;
    default:
      return 'Unknown status';
  }
}

/** Maps internal workflow classification → customer-facing `displayStatus`. */
export function customerKbWorkflowToApiDisplayStatus(
  wf: KnowledgeItemWorkflowDisplayStatus,
): CustomerKbItemApiDisplayStatus {
  switch (wf) {
    case 'out_of_storage':
      return 'out_of_storage';
    case 'uploading':
    case 'waiting_for_source':
      return 'uploading';
    case 'waiting_to_extract':
    case 'extracting_text':
      return 'extracting_text';
    case 'import_queued':
      return 'import_queued';
    case 'importing_table':
      return 'importing';
    case 'import_failed':
      return 'import_failed';
    case 'waiting_for_training':
      return 'training_required';
    case 'training_queued':
    case 'training':
      return 'training';
    case 'ready':
      return 'trained';
    case 'extraction_failed':
    case 'training_failed':
    default:
      return 'failed';
  }
}

/**
 * Customer-facing training label (`trainingStatus` on KB status polls) —
 * overlays import phases and storage cap codes on Mongo lifecycle enums.
 */
export function customerFacingKnowledgeTrainingStatus(input: {
  workflowDisplayStatus: KnowledgeItemWorkflowDisplayStatus;
  lifecycleStatus: string | null | undefined;
}): string {
  const w = input.workflowDisplayStatus;
  if (w === 'out_of_storage') return 'out_of_storage';
  if (w === 'import_queued') return 'import_queued';
  if (w === 'importing_table') return 'importing_table';
  if (w === 'import_failed') return 'import_failed';
  return normalizeKnowledgeTrainingStatus(String(input.lifecycleStatus ?? ''));
}

/** Derives booleans consistent with `{@link deriveKnowledgeBaseItemDisplayFields}` workflow output. */
export function customerKbTrainingActivityFlags(input: {
  sourceType: string;
  lifecycleStatus: KnowledgeBaseItemTrainingStatus;
  workflowDisplayStatus: KnowledgeItemWorkflowDisplayStatus;
}): Pick<CustomerKbItemApiDisplayBundle, 'isTraining' | 'isExtracting' | 'isImporting'> {
  const wf = input.workflowDisplayStatus;
  const st = normalizeKnowledgeTrainingStatus(String(input.lifecycleStatus ?? ''));
  const src = String(input.sourceType ?? '');

  const isExtracting =
    src === 'document' &&
    wf !== 'out_of_storage' &&
    WORKFLOW_EXTRACT_PHASES.has(wf);

  const isImporting = src === 'table' && WORKFLOW_IMPORT_PHASES.has(wf);

  let isTraining = false;
  if (wf !== 'out_of_storage' && (st === 'queued' || st === 'processing')) {
    const blockedByExtract = src === 'document' && WORKFLOW_EXTRACT_PHASES.has(wf);
    const blockedByImport = src === 'table' && WORKFLOW_IMPORT_PHASES.has(wf);
    isTraining = !blockedByExtract && !blockedByImport;
  }

  return { isTraining, isExtracting, isImporting };
}

/**
 * Canonical customer-facing fields (`displayStatus`, `displayLabel`, `displayMessage`,
 * poll `trainingStatus`, activity flags) from an already-derived workflow classification.
 */
export function finalizeCustomerKbItemApiDisplayBundle(
  wfDerived: { displayStatus: KnowledgeItemWorkflowDisplayStatus; displayMessage: string },
  input: { sourceType: string; status: string | null | undefined },
): CustomerKbItemApiDisplayBundle {
  const wf = wfDerived.displayStatus;
  const displayStatus = customerKbWorkflowToApiDisplayStatus(wf);
  const displayLabel =
    wf === 'training_queued'
      ? 'Training Queued'
      : wf === 'training'
        ? 'Training'
        : CUSTOMER_KB_DISPLAY_LABEL[displayStatus];
  const lifecycle = normalizeKnowledgeTrainingStatus(String(input.status ?? ''));
  const trainingStatus = customerFacingKnowledgeTrainingStatus({
    workflowDisplayStatus: wf,
    lifecycleStatus: String(input.status ?? ''),
  });
  const { isTraining, isExtracting, isImporting } = customerKbTrainingActivityFlags({
    sourceType: input.sourceType,
    lifecycleStatus: lifecycle,
    workflowDisplayStatus: wf,
  });
  return {
    displayStatus,
    displayLabel,
    displayMessage: wfDerived.displayMessage,
    trainingStatus,
    isTraining,
    isExtracting,
    isImporting,
  };
}

export function deriveCustomerKbItemApiDisplayBundle(
  input: Parameters<typeof deriveKnowledgeBaseItemDisplayFields>[0],
): CustomerKbItemApiDisplayBundle {
  return finalizeCustomerKbItemApiDisplayBundle(deriveKnowledgeBaseItemDisplayFields(input), {
    sourceType: input.sourceType,
    status: input.status,
  });
}

/**
 * Prefer persisted `tableMeta.importPhase`; when missing/stale, infer from live {@link TableImportJob} status.
 */
export function effectiveTableImportPhaseForDisplay(input: {
  tableImportPhase?: string | null;
  tableImportJobStatus?: string | null;
}): string {
  const phase = String(input.tableImportPhase ?? '').trim();
  const jobSt = String(input.tableImportJobStatus ?? '').trim().toLowerCase();
  if (phase === 'importing' || phase === 'import_failed' || phase === 'complete') return phase;
  if (jobSt === 'processing') return 'importing';
  if (jobSt === 'failed') return 'import_failed';
  if (jobSt === 'queued') return 'import_queued';
  return phase;
}

export function deriveKnowledgeBaseItemDisplayFields(input: {
  sourceType: string;
  /** Training lifecycle (`KnowledgeBaseItem.status`). */
  status: string | null | undefined;
  /** Extraction lifecycle; omitted on non-documents. */
  extractionStatus?: string | null;
  isContentExtracted?: boolean;
  content?: string;
  fileMeta?: Record<string, unknown>;
  uploadDocumentStatus?: string | null;
  tableImportPhase?: string | null;
  tableImportJobStatus?: string | null;
  trainingError?: string | null;
  extractionError?: string | null;
  importErrorCode?: string | null;
  importError?: string | null;
}): { displayStatus: KnowledgeItemWorkflowDisplayStatus; displayMessage: string } {
  if (
    knowledgeBaseItemRowIndicatesPlanLimitBotKbTotal({
      trainingError: input.trainingError,
      extractionError: input.extractionError,
      tableMeta: { importError: input.importError, importErrorCode: input.importErrorCode },
    })
  ) {
    return { displayStatus: 'out_of_storage', displayMessage: PLAN_LIMIT_BOT_KB_TOTAL_MESSAGE };
  }

  const src = String(input.sourceType ?? '');
  const st = normalizeKnowledgeTrainingStatus(String(input.status ?? ''));

  if (src === 'table') {
    const phase = effectiveTableImportPhaseForDisplay({
      tableImportPhase: input.tableImportPhase,
      tableImportJobStatus: input.tableImportJobStatus,
    });
    if (phase === 'import_queued') {
      return { displayStatus: 'import_queued', displayMessage: knowledgeItemWorkflowDisplayMessage('import_queued') };
    }
    if (phase === 'importing') {
      return { displayStatus: 'importing_table', displayMessage: knowledgeItemWorkflowDisplayMessage('importing_table') };
    }
    if (phase === 'import_failed') {
      return { displayStatus: 'import_failed', displayMessage: knowledgeItemWorkflowDisplayMessage('import_failed') };
    }
  }

  if (src === 'document') {
    const up = typeof input.uploadDocumentStatus === 'string' ? input.uploadDocumentStatus.trim() : '';
    if (up === 'upload_failed') {
      return {
        displayStatus: 'extraction_failed',
        displayMessage: 'Upload failed',
      };
    }
    if (up === 'uploading') {
      return {
        displayStatus: 'uploading',
        displayMessage: knowledgeItemWorkflowDisplayMessage('uploading'),
      };
    }
  }

  if (src !== 'document') {
    const d = deriveNonDocumentDisplay(st);
    return { displayStatus: d, displayMessage: knowledgeItemWorkflowDisplayMessage(d) };
  }

  const ex = inferDocumentKnowledgeExtractionStatusFromRow({
    sourceType: 'document',
    extractionStatus: input.extractionStatus,
    isContentExtracted: input.isContentExtracted,
    content: input.content,
    fileMeta: input.fileMeta,
  });

  const d = deriveDocumentDisplay(ex, st);
  return { displayStatus: d, displayMessage: knowledgeItemWorkflowDisplayMessage(d) };
}

function deriveNonDocumentDisplay(st: KnowledgeBaseItemTrainingStatus): KnowledgeItemWorkflowDisplayStatus {
  switch (st) {
    case 'pending':
      return 'waiting_for_training';
    case 'queued':
      return 'training_queued';
    case 'processing':
      return 'training';
    case 'ready':
      return 'ready';
    case 'failed':
    default:
      return 'training_failed';
  }
}

function deriveDocumentDisplay(
  extractionStatus: KnowledgeBaseItemExtractionStatus,
  trainingStatus: KnowledgeBaseItemTrainingStatus,
): KnowledgeItemWorkflowDisplayStatus {
  switch (normalizeKnowledgeExtractionStatus(extractionStatus)) {
    case 'not_required':
      return deriveNonDocumentDisplay(trainingStatus);
    case 'waiting_for_source':
      return 'waiting_for_source';
    case 'queued':
      return 'waiting_to_extract';
    case 'processing':
      return 'extracting_text';
    case 'failed':
      return 'extraction_failed';
    case 'done':
      switch (trainingStatus) {
        case 'pending':
          return 'waiting_for_training';
        case 'queued':
          return 'training_queued';
        case 'processing':
          return 'training';
        case 'ready':
          return 'ready';
        case 'failed':
        default:
          return 'training_failed';
      }
    default:
      return 'waiting_for_source';
  }
}
