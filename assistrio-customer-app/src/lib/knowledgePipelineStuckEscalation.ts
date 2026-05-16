import type { CustomerKnowledgeStatusItem, CustomerWorkspaceDocument } from '@/api/types';
import {
  getKnowledgeItemDisplayStatus,
  workspaceDocumentToDisplayInput,
  type KnowledgeItemDisplayResult,
} from '@/lib/knowledgeItemDisplayStatus';

/** Default aligns with product expectation for “long-running pipeline” escape hatches (delete / reset retry). */
const DEFAULT_STUCK_MINUTES = 30;

export function readKbPipelineStuckMinutes(): number {
  const raw =
    import.meta.env.VITE_KB_PIPELINE_STUCK_ESCALATION_MINUTES ??
    import.meta.env.VITE_KB_MANUAL_RETRY_STUCK_MINUTES;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_STUCK_MINUTES;
}

/** Wall-clock duration after which we surface stuck-pipeline delete / retry escalation UI. */
export const KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS = Math.max(1, readKbPipelineStuckMinutes()) * 60_000;

export type KnowledgePipelineStuckTimestamps = {
  displayStatus?: string | null;
  lastQueuedAt?: string | null;
  lastTrainingStartedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export function isoFromUnknownDate(u: unknown): string | null {
  if (u == null) return null;
  if (typeof u === 'string' && u.trim()) return u.trim();
  if (u instanceof Date && !Number.isNaN(u.getTime())) return u.toISOString();
  return null;
}

function parseIsoMs(iso: string | null | undefined): number {
  if (iso == null || !String(iso).trim()) return NaN;
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : NaN;
}

function earliestFiniteMs(...vals: number[]): number | null {
  const ok = vals.filter((v) => Number.isFinite(v));
  if (ok.length === 0) return null;
  return Math.min(...ok);
}

/** Maps {@link getKnowledgeItemDisplayStatus} keys → customer KB status poll `displayStatus` strings. */
export function mapDisplayResultKeyToCustomerApiStatus(key: KnowledgeItemDisplayResult['key']): string | null {
  switch (key) {
    case 'uploading':
      return 'uploading';
    case 'uploaded':
      return 'uploaded';
    case 'extracting':
      return 'extracting_text';
    case 'importing':
      return 'importing';
    case 'import_failed':
      return 'import_failed';
    case 'queued':
      return 'training';
    case 'needs_training':
      return 'training_required';
    case 'training':
      return 'training';
    case 'extraction_failed':
    case 'training_failed':
      return 'failed';
    case 'upload_failed':
      return null;
    case 'ready':
    case 'unknown':
    default:
      return null;
  }
}

/**
 * Reference instant for “how long has this pipeline phase been active” — conservative reads from poll/row fields.
 */
export function knowledgePipelineStuckReferenceMs(ts: KnowledgePipelineStuckTimestamps): number | null {
  const ds = String(ts.displayStatus ?? '').trim().toLowerCase();
  if (!ds) return null;

  if (ds === 'uploading') {
    return earliestFiniteMs(parseIsoMs(ts.createdAt), parseIsoMs(ts.updatedAt));
  }
  if (ds === 'uploaded') {
    return earliestFiniteMs(parseIsoMs(ts.createdAt), parseIsoMs(ts.updatedAt));
  }
  if (ds === 'extracting_text') {
    return earliestFiniteMs(parseIsoMs(ts.lastQueuedAt), parseIsoMs(ts.updatedAt));
  }
  if (ds === 'import_queued' || ds === 'importing') {
    return earliestFiniteMs(parseIsoMs(ts.updatedAt), parseIsoMs(ts.lastQueuedAt));
  }
  if (ds === 'training' || ds === 'training_required') {
    return earliestFiniteMs(
      parseIsoMs(ts.lastTrainingStartedAt),
      parseIsoMs(ts.lastQueuedAt),
      parseIsoMs(ts.updatedAt),
    );
  }
  if (ds === 'failed' || ds === 'extraction_failed' || ds === 'import_failed') {
    const t = parseIsoMs(ts.updatedAt);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export function knowledgePipelineStuckEligible(ts: KnowledgePipelineStuckTimestamps): boolean {
  const ref = knowledgePipelineStuckReferenceMs(ts);
  if (ref == null || !Number.isFinite(ref)) return false;
  return Date.now() - ref >= KNOWLEDGE_PIPELINE_STUCK_ESCALATION_AFTER_MS;
}

/** Customer `displayStatus` values where we allow removing an item even while the pipeline claims “busy”. */
const PHASES_ALLOW_STUCK_DELETE = new Set([
  'uploading',
  'uploaded',
  'extracting_text',
  'import_queued',
  'importing',
  'training',
  'training_required',
  'failed',
  'extraction_failed',
  'import_failed',
]);

export function knowledgePipelineAllowStuckItemDelete(ts: KnowledgePipelineStuckTimestamps): boolean {
  const ds = String(ts.displayStatus ?? '').trim().toLowerCase();
  if (!PHASES_ALLOW_STUCK_DELETE.has(ds)) return false;
  return knowledgePipelineStuckEligible(ts);
}

export function buildDocumentStuckEscalationTimestamps(args: {
  kbPollItem: CustomerKnowledgeStatusItem | null | undefined;
  doc: CustomerWorkspaceDocument | null | undefined;
}): KnowledgePipelineStuckTimestamps {
  const { kbPollItem, doc } = args;
  const fromPoll = String(kbPollItem?.displayStatus ?? '').trim();
  const fromDoc = String(doc?.displayStatus ?? '').trim();
  let inferred = '';
  if (!fromPoll && !fromDoc && doc) {
    const k = getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(doc)).key;
    inferred = mapDisplayResultKeyToCustomerApiStatus(k) ?? '';
  }
  const displayStatus = fromPoll || fromDoc || inferred || null;
  return {
    displayStatus,
    lastQueuedAt: kbPollItem?.lastQueuedAt ?? null,
    lastTrainingStartedAt: kbPollItem?.lastTrainingStartedAt ?? null,
    updatedAt: kbPollItem?.updatedAt ?? isoFromUnknownDate((doc as Record<string, unknown>)?.updatedAt) ?? null,
    createdAt: isoFromUnknownDate(doc?.createdAt),
  };
}

export function buildKbPollStuckEscalationTimestamps(
  kbPollItem: CustomerKnowledgeStatusItem | null | undefined,
): KnowledgePipelineStuckTimestamps {
  return {
    displayStatus: kbPollItem?.displayStatus ?? null,
    lastQueuedAt: kbPollItem?.lastQueuedAt ?? null,
    lastTrainingStartedAt: kbPollItem?.lastTrainingStartedAt ?? null,
    updatedAt: kbPollItem?.updatedAt ?? null,
    createdAt: null,
  };
}
