/**
 * Canonical knowledge lifecycle — must match backend `KnowledgeBaseItemTrainingStatus`.
 * Shared by Documents ingest view, FAQs, snippets, datasheets, suggestions, overview, polling.
 */
import { isKbPlanLimitTrainingError } from './knowledgeStorageLimits';

export const KNOWLEDGE_TRAINING_STATUSES = [
  'pending',
  'queued',
  'processing',
  'ready',
  'failed',
  'out_of_storage',
] as const;

export type KnowledgeTrainingStatus = (typeof KNOWLEDGE_TRAINING_STATUSES)[number];

const CANONICAL = new Set<string>(KNOWLEDGE_TRAINING_STATUSES);

/** Same alias map semantics as backend `normalizeKnowledgeTrainingStatus`. */
const ALIASES: Record<string, KnowledgeTrainingStatus> = {
  done: 'ready',
  completed: 'ready',
  complete: 'ready',
  success: 'ready',
  successful: 'ready',
  ingesting: 'processing',
  running: 'processing',
  extracting: 'processing',
  indexing: 'processing',
  training: 'processing',
  upload: 'pending',
  uploaded: 'pending',
  upload_pending: 'pending',
  /** Do not map `uploading` — it is client-only for in-flight multipart uploads, not a DB status. */
  idle: 'pending',
  stale: 'pending',
  new: 'pending',
  queued_for_training: 'queued',
  queued_for_processing: 'queued',
  queued_for_embedding: 'queued',
  aborted: 'failed',
  aborted_with_error: 'failed',
};

export function normalizeKnowledgeTrainingStatus(
  raw: string | number | boolean | null | undefined,
): KnowledgeTrainingStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s) return 'pending';
  if (CANONICAL.has(s)) return s as KnowledgeTrainingStatus;
  return ALIASES[s] ?? 'pending';
}

/**
 * Merge workspace bot snapshot training `status` with `GET …/knowledge/status` row `status`.
 * A stale poll showing `ready` must not hide `pending` / `queued` / `processing` from a fresh bot reload
 * (e.g. after a content edit while “Use in replies” is off).
 */
export function mergeKbTrainingLifecycleForDisplay(
  fromBot: KnowledgeTrainingStatus | string | null | undefined,
  fromPoll: KnowledgeTrainingStatus | string | null | undefined,
): KnowledgeTrainingStatus {
  const pollEmpty = fromPoll == null || !String(fromPoll).trim();
  const botEmpty = fromBot == null || !String(fromBot).trim();
  if (pollEmpty && botEmpty) return 'pending';
  if (pollEmpty) return normalizeKnowledgeTrainingStatus(fromBot);
  if (botEmpty) return normalizeKnowledgeTrainingStatus(fromPoll);

  const b = normalizeKnowledgeTrainingStatus(fromBot);
  const p = normalizeKnowledgeTrainingStatus(fromPoll);
  if (b === p) return b;

  const terminalBad = (s: KnowledgeTrainingStatus) => s === 'failed' || s === 'out_of_storage';
  if (terminalBad(b)) return b;
  if (terminalBad(p)) return p;

  if (b === 'ready' && p !== 'ready') return p;
  if (p === 'ready' && b !== 'ready') return b;

  const stage = (s: KnowledgeTrainingStatus): number => {
    switch (s) {
      case 'pending':
        return 1;
      case 'queued':
        return 2;
      case 'processing':
        return 3;
      default:
        return 0;
    }
  };
  return stage(b) >= stage(p) ? b : p;
}

/**
 * Maps customer-facing KB chip labels (from GET bot / lightweight status `displayLabel`) to canonical
 * lifecycle colors so dots match the visible text when poll rows and list APIs disagree on raw `status`.
 */
export function inferKnowledgeTrainingStatusFromKbDisplayLabel(
  raw: string | null | undefined,
): KnowledgeTrainingStatus | null {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!s || s === '—' || s === '-') return null;
  if (s === 'out of storage') return 'out_of_storage';
  if (s === 'import failed') return 'failed';
  if (s === 'importing') return 'processing';
  if (s === 'training required') return 'pending';
  if (s === 'required') return 'pending';
  if (s === 'needs review') return 'pending';
  if (s === 'training queued' || s === 'queued for training' || s.startsWith('queued for')) return 'queued';
  if (s === 'processing') return 'processing';
  /** Backend `Training…` chip and legacy standalone "training" labels */
  if (s === 'training') return 'processing';
  if (s.startsWith('training…') || s.startsWith('training...')) return 'processing';
  if (s === 'training failed') return 'failed';
  if (s === 'trained') return 'ready';
  if (s === 'ready') return 'ready';
  if (s === 'failed') return 'failed';
  if (s === 'extracting text') return 'processing';
  return null;
}

/**
 * True while the workspace coordinator should poll `GET …/knowledge/training/status` and (when gated)
 * typed `GET …/knowledge/status`.
 * Poll only while an in-flight pipeline flag is true: {@link TrainingStatusHeadlineInput.isTraining},
 * {@link TrainingStatusHeadlineInput.training_queued}, import, or text extraction (`isExtracting` / `isTextExtracting`).
 */
export function isKnowledgePipelinePollingActive(ts: TrainingStatusHeadlineInput | null | undefined): boolean {
  if (ts == null) return false;
  if (ts.isTraining === true || ts.isImporting === true || ts.training_queued === true) return true;
  return trainingStatusIndicatesExtracting(ts);
}

/** Document text extraction globally (explicit flag or legacy `isTextExtracting`). */
export function trainingStatusIndicatesExtracting(
  ts: { isExtracting?: boolean; isTextExtracting?: boolean } | null | undefined,
): boolean {
  return ts?.isExtracting === true || ts?.isTextExtracting === true;
}

/** Main agent headline phase — mirrors backend `displayPhase` on GET `/knowledge/training/status`. */
export type AgentTrainingDisplayPhase =
  | 'empty'
  | 'ready'
  | 'training_required'
  | 'extracting'
  | 'importing'
  | 'training'
  | 'partially_ready'
  | 'failed';

const DISPLAY_PHASE_SET = new Set<string>([
  'empty',
  'ready',
  'training_required',
  'extracting',
  'importing',
  'training',
  'partially_ready',
  'failed',
]);

function isAgentTrainingDisplayPhase(raw: string | undefined): raw is AgentTrainingDisplayPhase {
  return raw !== undefined && DISPLAY_PHASE_SET.has(raw);
}

type TrainingStatusHeadlineInput = {
  displayPhase?: string;
  label?: string;
  isTraining?: boolean;
  /** GET `/knowledge/training/status` — idle pipeline but pending/scheduled training lifecycle. */
  training_queued?: boolean;
  isExtracting?: boolean;
  isTextExtracting?: boolean;
  isImporting?: boolean;
  needsTraining?: boolean;
  status?: string;
  counts?: {
    pending?: number;
    queued?: number;
    processing?: number;
    ready?: number;
    failed?: number;
    total?: number;
  };
  lifecycleCounts?: {
    extractingCount?: number;
    datasheetImportPipelineCount?: number;
    trainingQueuedCount?: number;
    trainingProcessingCount?: number;
  };
} | null;

/**
 * Maps `GET …/knowledge/training/status` to the canonical headline phase.
 * Prefers `displayPhase` when present; otherwise mirrors backend priority (importing → extracting → training → …).
 */
export function resolveAgentTrainingHeadlinePhase(ts: TrainingStatusHeadlineInput): AgentTrainingDisplayPhase {
  if (ts == null) return 'ready';
  const phase = isAgentTrainingDisplayPhase(ts.displayPhase)
    ? ts.displayPhase
    : fallbackAgentTrainingHeadlinePhase(ts);

  const lc = ts.lifecycleCounts;
  if (
    phase === 'training_required' &&
    (ts.isTraining === true ||
      ts.status === 'training' ||
      (lc?.trainingQueuedCount ?? 0) > 0 ||
      (lc?.trainingProcessingCount ?? 0) > 0 ||
      (ts.counts?.queued ?? 0) > 0 ||
      (ts.counts?.processing ?? 0) > 0)
  ) {
    return 'training';
  }
  return phase;
}

function fallbackAgentTrainingHeadlinePhase(ts: NonNullable<TrainingStatusHeadlineInput>): AgentTrainingDisplayPhase {
  const lc = ts.lifecycleCounts;
  const importing = ts.isImporting === true || (lc?.datasheetImportPipelineCount ?? 0) > 0;
  if (importing) return 'importing';

  const extracting =
    ts.isExtracting === true || ts.isTextExtracting === true || (lc?.extractingCount ?? 0) > 0;
  if (extracting) return 'extracting';

  const trainingActive =
    ts.isTraining === true ||
    ts.status === 'training' ||
    (lc?.trainingQueuedCount ?? 0) > 0 ||
    (lc?.trainingProcessingCount ?? 0) > 0 ||
    (ts.counts?.queued ?? 0) > 0 ||
    (ts.counts?.processing ?? 0) > 0;
  if (trainingActive) return 'training';

  const ready = ts.counts?.ready ?? 0;
  const failed = ts.counts?.failed ?? 0;
  if (ready === 0 && failed > 0) return 'failed';
  if (ready > 0 && failed > 0) return 'partially_ready';

  const pending = ts.counts?.pending ?? 0;
  if (pending > 0 || ts.status === 'needs_training') return 'training_required';

  const total = ts.counts?.total ?? 0;
  if (total === 0) return 'empty';

  return 'ready';
}

/** Fallback English labels when `response.label` is absent (older API). */
export const AGENT_TRAINING_HEADLINE_LABEL: Record<AgentTrainingDisplayPhase, string> = {
  empty: 'No knowledge yet',
  ready: 'Trained',
  training_required: 'Training queued',
  extracting: 'Extracting',
  importing: 'Importing',
  training: 'Training',
  partially_ready: 'Partially Trained',
  failed: 'Training Failed',
};

/** Headline string: prefer backend `label`. */
export function resolveAgentTrainingHeadlineText(ts: TrainingStatusHeadlineInput): string {
  if (ts == null) return AGENT_TRAINING_HEADLINE_LABEL.ready;
  const trimmed = typeof ts.label === 'string' ? ts.label.trim() : '';
  if (trimmed) return trimmed;
  const phase = resolveAgentTrainingHeadlinePhase(ts);
  return AGENT_TRAINING_HEADLINE_LABEL[phase];
}

/** @deprecated Use {@link AgentTrainingDisplayPhase} via {@link resolveAgentTrainingHeadlinePhase}. */
export type AgentTrainingPrimaryPhase = 'training' | 'training_required' | 'trained';

/** @deprecated Use {@link resolveAgentTrainingHeadlinePhase}. */
export function resolveAgentTrainingPrimaryPhase(ts: TrainingStatusHeadlineInput): AgentTrainingPrimaryPhase {
  const p = resolveAgentTrainingHeadlinePhase(ts);
  if (p === 'training_required' || p === 'empty') return 'training_required';
  if (p === 'training' || p === 'extracting' || p === 'importing') return 'training';
  return 'trained';
}

/** @deprecated Prefer {@link AGENT_TRAINING_HEADLINE_LABEL} and {@link resolveAgentTrainingHeadlineText}. */
export const AGENT_TRAINING_PRIMARY_HEADLINE: Record<AgentTrainingPrimaryPhase, string> = {
  training: 'Training',
  training_required: 'Training queued',
  trained: 'Trained',
};

export function agentTrainingPrimaryDotClass(phase: AgentTrainingDisplayPhase): string {
  switch (phase) {
    case 'training':
    case 'extracting':
    case 'importing':
      return 'bg-blue-600';
    case 'training_required':
      return 'bg-orange-500';
    case 'failed':
      return 'bg-red-600';
    case 'partially_ready':
      return 'bg-amber-500';
    case 'empty':
      return 'bg-amber-400';
    case 'ready':
    default:
      return 'bg-emerald-600';
  }
}

export function agentTrainingPrimaryLabelTextClass(phase: AgentTrainingDisplayPhase): string {
  switch (phase) {
    case 'training':
    case 'extracting':
    case 'importing':
      return 'text-blue-900';
    case 'training_required':
      return 'text-orange-950';
    case 'failed':
      return 'text-red-900';
    case 'partially_ready':
      return 'text-amber-950';
    case 'empty':
      return 'text-amber-900';
    case 'ready':
    default:
      return 'text-emerald-800';
  }
}

/** Sidebar agent card: three buckets — hierarchy Required training → Training → Trained. */
export type AgentSidebarTrainingBucket = 'required_training' | 'training' | 'trained';

/**
 * Sidebar headline bucket order:
 * 1. **Required training** — `needsTraining`, `counts.pending > 0`, or phase empty / training_required (not `failed`; failed-only is shown via primary phase styling in the sidebar card)
 * 2. **Training** — embedding pipeline or mixed ready+failed (`training`, `partially_ready`)
 * 3. **Trained** — steady (`ready`) or peripheral phases (`extracting`, `importing`) when no pending queue
 */
export function resolveAgentSidebarTrainingBucket(ts: TrainingStatusHeadlineInput): AgentSidebarTrainingBucket {
  if (ts == null) return 'trained';
  const phase = resolveAgentTrainingHeadlinePhase(ts);
  const pending = ts.counts?.pending ?? 0;
  const needsTraining = ts.needsTraining === true;

  if (
    needsTraining ||
    pending > 0 ||
    phase === 'training_required' ||
    phase === 'empty'
  ) {
    return 'required_training';
  }
  if (phase === 'training' || phase === 'partially_ready') return 'training';
  return 'trained';
}

export const AGENT_SIDEBAR_TRAINING_LABEL: Record<AgentSidebarTrainingBucket, string> = {
  required_training: 'Training Required',
  training: 'Training',
  trained: 'Trained',
};

export function agentSidebarTrainingBucketDotClass(bucket: AgentSidebarTrainingBucket): string {
  switch (bucket) {
    case 'required_training':
      return 'bg-orange-500';
    case 'training':
      return 'bg-blue-600';
    case 'trained':
    default:
      return 'bg-emerald-600';
  }
}

export function agentSidebarTrainingBucketLabelClass(bucket: AgentSidebarTrainingBucket): string {
  switch (bucket) {
    case 'required_training':
      return 'text-orange-950';
    case 'training':
      return 'text-blue-900';
    case 'trained':
    default:
      return 'text-emerald-800';
  }
}

const DOC_UPLOAD_LIFECYCLE = new Set(['uploading', 'uploaded', 'upload_failed']);

/**
 * Training column / polling — prefer explicit `trainingStatus` when the API separates file upload (`status`)
 * from KB lifecycle.
 */
export function baselineDocumentRowTrainingStatus(row: {
  trainingStatus?: unknown;
  status?: unknown;
  documentStatus?: unknown;
}): KnowledgeTrainingStatus {
  if (row.trainingStatus != null && String(row.trainingStatus).trim()) {
    return normalizeKnowledgeTrainingStatus(String(row.trainingStatus));
  }
  const ds = typeof row.documentStatus === 'string' ? row.documentStatus.trim().toLowerCase() : '';
  if (DOC_UPLOAD_LIFECYCLE.has(ds)) return 'pending';
  const raw = row.status;
  return normalizeKnowledgeTrainingStatus(
    typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? raw : '',
  );
}

export type DocumentPollMergeHints = {
  /** From `GET .../knowledge/status` when present — aligns poll with latest IngestJob. */
  latestIngestJobStatus?: string | null;
  extractionStatus?: string | null;
  displayStatus?: string | null;
  /** Customer-facing status from lightweight KB status (e.g. `out_of_storage`). */
  trainingStatus?: string | null;
};

/**
 * After text is persisted, `latestIngestJobStatus` may still say `processing`/`queued` for the ingest job while
 * `poll.status` already reflects KB training (`pending` / `queued`). Prefer the poll so the UI does not flash **Training**.
 */
function documentMergeTrustPollLifecycleOverIngestJob(
  _p: KnowledgeTrainingStatus,
  hints?: DocumentPollMergeHints,
): boolean {
  const ex = String(hints?.extractionStatus ?? '')
    .trim()
    .toLowerCase();
  if (ex === 'done' || ex === 'not_required') return true;
  const ds = String(hints?.displayStatus ?? '')
    .trim()
    .toLowerCase();
  if (
    ds === 'training_required' ||
    ds === 'training_queued' ||
    ds === 'trained' ||
    ds === 'ready' ||
    ds === 'passed'
  ) {
    return true;
  }
  return false;
}

/**
 * Combines `{Document}.status` (list API) with `GET …/knowledge/status?type=document` polling so transient
 * Document vs KB item desynchronization does not cause visible training-state flapping in the UI.
 */
export function mergeDocumentRowCanonicalTrainingStatus(
  documentStatusRaw: string | number | boolean | null | undefined,
  pollStatusRaw: string | number | boolean | null | undefined,
  pollHints?: DocumentPollMergeHints,
): KnowledgeTrainingStatus {
  const extractionFailed =
    pollHints?.extractionStatus === 'failed' || pollHints?.displayStatus === 'extraction_failed';
  const pollDisplay = String(pollHints?.displayStatus ?? '').trim();
  const pollTrain = String(pollHints?.trainingStatus ?? '').trim();
  if (pollDisplay === 'out_of_storage' || pollTrain === 'out_of_storage') return 'out_of_storage';

  const d = normalizeKnowledgeTrainingStatus(documentStatusRaw);
  const p = normalizeKnowledgeTrainingStatus(pollStatusRaw);
  const jl = normalizeJobLiteral(pollHints?.latestIngestJobStatus);

  if (extractionFailed) {
    if (p === 'failed') return 'pending';
    if (d === 'failed') return p;
  }

  if (d === 'failed' || p === 'failed') return 'failed';

  if (jl === 'processing') {
    if (
      documentMergeTrustPollLifecycleOverIngestJob(p, pollHints) &&
      (p === 'pending' || p === 'queued' || p === 'ready')
    ) {
      return p;
    }
    return 'processing';
  }
  if (jl === 'queued') {
    if (documentMergeTrustPollLifecycleOverIngestJob(p, pollHints) && (p === 'pending' || p === 'ready')) {
      return p;
    }
    return 'queued';
  }

  if (jl === 'failed') return 'failed';

  /** KB poll can lag on `processing` while the doc row already flipped `ready`; use latest job hint. */
  if (d === 'ready' && p === 'processing') {
    if (!jl || jl === 'done') return 'ready';
  }

  if (d === 'processing' || p === 'processing') {
    if (d === 'ready' && p === 'ready') return 'ready';
    /**
     * Document list (`GET …/documents`) can stay on `processing` for one or more ticks after
     * `GET …/knowledge/status` already has `ready` and the ingest job is done — without this,
     * the table never flips to Ready. Trust poll when the job is not actively queued/processing
     * (see `jl` checks at the top of this function).
     */
    if (p === 'ready' && jl !== 'processing' && jl !== 'queued') return 'ready';
    return 'processing';
  }

  const pipeline = ['pending', 'queued', 'processing', 'ready'] as const;
  const ix = (s: KnowledgeTrainingStatus): number => {
    const i = pipeline.indexOf(s as (typeof pipeline)[number]);
    return i >= 0 ? i : -1;
  };
  const di = ix(d);
  const pi = ix(p);
  if (di >= 0 && pi >= 0) return pipeline[Math.max(di, pi)];
  return d;
}

/** IngestJob uses literal `queued` | `processing` | `done` | `failed` — normalize without mapping `done→ready`. */
function normalizeJobLiteral(raw: string | number | boolean | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (s === 'queued' || s === 'processing' || s === 'done' || s === 'failed') return s;
  return null;
}

export function knowledgeTrainingStatusLabel(status: KnowledgeTrainingStatus | string | null | undefined): string {
  const n = normalizeKnowledgeTrainingStatus(status);
  if (n === 'pending') return 'Training Required';
  if (n === 'queued') return 'Training Queued';
  if (n === 'processing') return 'Training';
  if (n === 'ready') return 'Trained';
  if (n === 'failed') return 'Training Failed';
  if (n === 'out_of_storage') return 'Out of storage';
  return '—';
}

export function knowledgeTrainingStatusDotClassName(status: KnowledgeTrainingStatus | string | null | undefined): string {
  const n = normalizeKnowledgeTrainingStatus(status);
  if (n === 'ready') return 'bg-emerald-500';
  if (n === 'failed' || n === 'out_of_storage') return 'bg-red-500';
  /** Upload / import / extract / embed — active work */
  if (n === 'processing') return 'bg-blue-600';
  /** Waiting in queue vs not yet queued — amber was ambiguous next to warnings. */
  if (n === 'pending') return 'bg-orange-500';
  if (n === 'queued') return 'bg-yellow-500';
  return 'bg-slate-300';
}

/** Pill / chip styles for dense tables (documents list). */
export function knowledgeTrainingStatusBadgeClassName(status: KnowledgeTrainingStatus | string | null | undefined): string {
  const n = normalizeKnowledgeTrainingStatus(status);
  if (n === 'ready') return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80';
  if (n === 'processing') return 'bg-blue-50 text-blue-900 ring-1 ring-blue-200/85';
  if (n === 'failed' || n === 'out_of_storage') return 'bg-red-50 text-red-900 ring-1 ring-red-200/85';
  if (n === 'pending') return 'bg-orange-50 text-orange-950 ring-1 ring-orange-200/90';
  if (n === 'queued') return 'bg-yellow-50 text-yellow-950 ring-1 ring-yellow-200/90';
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80';
}

/** Client-only while a file is still uploading — not a DB `KnowledgeTrainingStatus`; colors match active **Training** (`processing`). */
export function clientDocumentUploadingBadgeClassName(): string {
  return knowledgeTrainingStatusBadgeClassName('processing');
}

export function clientDocumentUploadingLabel(): string {
  return 'Uploading';
}

/** Inline helper for table cells that pair a spinner with the Uploading label (same chroma as in-progress KB work). */
export function clientDocumentUploadingInlineTextClassName(): string {
  return 'text-blue-900';
}

function formatRelativeIsoShort(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return iso;
  }
}

/** Next training run hint when `runAfter` is in the future (customer KB lists + modal). */
export function knowledgeTrainingQueuedTimeSubline(runAfterIso: string | null | undefined): string | null {
  if (typeof runAfterIso !== 'string' || !runAfterIso.trim()) return null;
  const d = new Date(runAfterIso.trim());
  if (!Number.isFinite(d.getTime())) return null;
  if (d.getTime() <= Date.now()) return 'Due now';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return runAfterIso.trim();
  }
}

/** Native tooltip: full calendar date + time for the next scheduled training run. */
export function knowledgeTrainingNextDueTooltip(runAfterIso: string | null | undefined): string | null {
  if (typeof runAfterIso !== 'string' || !runAfterIso.trim()) return null;
  const d = new Date(runAfterIso.trim());
  if (!Number.isFinite(d.getTime())) return null;
  try {
    const full = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(d);
    return `Next training due on ${full}`;
  } catch {
    return `Next training due on ${runAfterIso.trim()}`;
  }
}

/** Portal tooltip body for list-row training pills (Suggestions, Q&A, snippets, datasheets). */
export function knowledgeTrainingStatusPillHoverDescription(
  canonical: KnowledgeTrainingStatus | string | null | undefined,
): string {
  const c = normalizeKnowledgeTrainingStatus(canonical);
  switch (c) {
    case 'pending':
      return 'Training has not finished or still needs to run. This knowledge is not ready for retrieval in replies until the status is Ready.';
    case 'queued':
      return 'Training is scheduled and runs automatically. The timer shows when it is expected to start.';
    case 'processing':
      return 'Training is in progress—content is being indexed and embedded for your assistant.';
    case 'ready':
      return 'Training finished successfully. If “Use in replies” is on, this item can be retrieved when generating answers (when eligible).';
    case 'failed':
      return 'Training failed. Review the error on this item or retry from Knowledge overview.';
    case 'out_of_storage':
      return 'Training is blocked by your workspace storage limit. Free space or upgrade to continue.';
    default:
      return 'Training status for this knowledge item.';
  }
}

function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

/**
 * Digital countdown until `runAfter` for live timers (`01:00`, `01:05:30`).
 * Past or due times show “Training soon” (first-time / immediate queue). Very far future falls back to medium+short absolute time.
 */
export function knowledgeTrainingRunAfterCountdown(
  runAfterIso: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (typeof runAfterIso !== 'string' || !runAfterIso.trim()) return null;
  const t = new Date(runAfterIso.trim()).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - nowMs;
  const fourteenDays = 14 * 24 * 60 * 60 * 1000;
  if (diff >= fourteenDays) {
    return knowledgeTrainingQueuedTimeSubline(runAfterIso);
  }
  if (diff <= 0) return 'Training soon';
  const secTotal = Math.floor(diff / 1000);
  if (secTotal < 3600) {
    return `${pad2(Math.floor(secTotal / 60))}:${pad2(secTotal % 60)}`;
  }
  const h = Math.floor(secTotal / 3600);
  const m = Math.floor((secTotal % 3600) / 60);
  const s = secTotal % 60;
  return h > 99 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** Subline under “Training Queued” when `runAfter` is set (countdown). Not shown for “Training Required” (`pending`). */
export function knowledgeTrainingListScheduleSubline(
  canonical: KnowledgeTrainingStatus | string | null | undefined,
  runAfterIso: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  const c = normalizeKnowledgeTrainingStatus(canonical);
  if (c !== 'queued') return null;
  return knowledgeTrainingRunAfterCountdown(runAfterIso, nowMs);
}

/** Returns a caption like “Next · …” only when canonical training state is queued and `runAfter` is usable. */
export function knowledgeTrainingQueuedScheduleSubline(
  canonical: KnowledgeTrainingStatus | string | null | undefined,
  runAfterIso: string | null | undefined,
): string | null {
  if (normalizeKnowledgeTrainingStatus(canonical) !== 'queued') return null;
  return knowledgeTrainingRunAfterCountdown(runAfterIso, Date.now());
}

/**
 * One timeline string for document list/detail “activity” column — matches pipeline state
 * (GET `/knowledge/status?type=document` merge supplies `runAfter`, `lastTrainingStartedAt`, etc.).
 */
export function knowledgeDocumentActivityCellText(row: {
  status?: string | null;
  trainingStatus?: string | null;
  documentStatus?: string | null;
  ingestedAt?: string | Date | null;
  /** Polling / API */
  trainingError?: string | null;
  lastQueuedAt?: string | null;
  runAfter?: string | null;
  lastTrainingStartedAt?: string | null;
  lastTrainedAt?: string | null;
}): string {
  const st = baselineDocumentRowTrainingStatus(row);
  const err = typeof row.trainingError === 'string' ? row.trainingError.trim() : '';
  const ts = String(row.trainingStatus ?? '').trim();
  if (ts === 'out_of_storage' || isKbPlanLimitTrainingError(err)) {
    return knowledgeTrainingStatusLabel('out_of_storage');
  }

  if (st === 'pending') {
    return knowledgeTrainingStatusLabel('pending');
  }
  if (st === 'queued') {
    return knowledgeTrainingStatusLabel('queued');
  }
  if (st === 'processing') {
    const started =
      typeof row.lastTrainingStartedAt === 'string' && row.lastTrainingStartedAt.trim()
        ? row.lastTrainingStartedAt
        : null;
    if (started) {
      const rel = formatRelativeIsoShort(started);
      return rel ? `Training started ${rel}` : knowledgeTrainingStatusLabel('processing');
    }
    return knowledgeTrainingStatusLabel('processing');
  }
  if (st === 'ready') {
    const fromIngested =
      row.ingestedAt != null
        ? typeof row.ingestedAt === 'string'
          ? row.ingestedAt
          : row.ingestedAt instanceof Date && Number.isFinite(row.ingestedAt.getTime())
            ? row.ingestedAt.toISOString()
            : null
        : null;
    const iso =
      typeof row.lastTrainedAt === 'string' && row.lastTrainedAt.trim()
        ? row.lastTrainedAt
        : fromIngested;
    const rel = formatRelativeIsoShort(iso ?? null);
    return rel ? `Last trained ${rel}` : knowledgeTrainingStatusLabel('ready');
  }
  if (st === 'failed') {
    return err || knowledgeTrainingStatusLabel('failed');
  }
  return '—';
}
