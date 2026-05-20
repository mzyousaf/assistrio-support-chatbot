import type { AgentTrainingDisplayPhase } from './knowledgeTrainingStatus';

export type AgentTrainingSublineDensity = 'compact' | 'comfortable';

export type ResolvedAgentTrainingSubline =
  | { kind: 'text'; tone: 'muted' | 'neutral' | 'warning'; text: string }
  | { kind: 'lastTrained'; relativeLabel: string };

/** Relative time for last trained (sidebar “Last trained …”). */
function formatLastTrainedRelative(iso: string): string {
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
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function agentTrainingSublineToneClass(tone: 'muted' | 'neutral' | 'warning'): string {
  if (tone === 'warning') return 'text-amber-900';
  if (tone === 'neutral') return 'text-slate-600';
  return 'text-slate-500';
}

/**
 * Secondary line under the agent training headline (overview header vs sidebar card).
 * Compact = short for tight layouts; comfortable = one extra clause of context without repeating the headline.
 */
export function resolveAgentTrainingPhaseSubline(params: {
  phase: AgentTrainingDisplayPhase | null;
  estimatedLabel: string;
  trainingPipelineBusy: boolean;
  pendingCount: number;
  extractionFailedCount: number;
  lastTrainedIso?: string | null;
  density: AgentTrainingSublineDensity;
  /** Sidebar: show “Last trained …” when phase is ready and timestamp exists. */
  showLastTrainedWhenReady?: boolean;
}): ResolvedAgentTrainingSubline | null {
  const est = params.estimatedLabel.trim();
  const { phase, density } = params;

  if (phase === 'training' && est !== '') {
    return { kind: 'text', tone: 'muted', text: est };
  }

  if (phase === 'extracting') {
    return {
      kind: 'text',
      tone: 'neutral',
      text:
        density === 'compact'
          ? 'Pulling text from uploads into your knowledge index.'
          : 'Reading uploaded files and extracting text so they can be embedded and used in replies.',
    };
  }

  if (phase === 'importing') {
    return {
      kind: 'text',
      tone: 'neutral',
      text:
        density === 'compact'
          ? 'Loading structured table rows into knowledge.'
          : 'Datasheet import is copying rows into structured knowledge; training runs after import finishes.',
    };
  }

  if (phase === 'partially_ready') {
    return {
      kind: 'text',
      tone: 'neutral',
      text:
        density === 'compact'
          ? 'Mixed state: Trained items plus failures in some lists.'
          : 'Some sources are trained and live; others failed or still need training — open each list to fix or retry.',
    };
  }

  if (phase === 'failed') {
    return {
      kind: 'text',
      tone: 'warning',
      text:
        density === 'compact'
          ? 'Failures in one or more sections — open each list to retry.'
          : 'One or more knowledge sources failed. Open Documents, Q&A, Snippets, or Tables and use retry or edit where offered.',
    };
  }

  if (params.extractionFailedCount > 0) {
    return {
      kind: 'text',
      tone: 'warning',
      text:
        density === 'compact'
          ? 'Some files didn’t extract — open each document to retry.'
          : 'Text extraction failed for one or more uploads. Open the document detail and retry extraction, or replace the file.',
    };
  }

  if (phase === 'training_required' && params.trainingPipelineBusy && est !== '') {
    return { kind: 'text', tone: 'muted', text: est };
  }

  if (phase === 'training_required' && params.pendingCount === 0) {
    return {
      kind: 'text',
      tone: 'muted',
      text:
        density === 'compact'
          ? 'Saved changes aren’t queued yet — use Retrain bot.'
          : 'Your edits are saved but not in the training queue. Retrain bot queues pending items so embeddings update.',
    };
  }

  if (
    params.showLastTrainedWhenReady &&
    phase === 'ready' &&
    typeof params.lastTrainedIso === 'string' &&
    params.lastTrainedIso.trim()
  ) {
    const rel = formatLastTrainedRelative(params.lastTrainedIso.trim());
    if (rel) return { kind: 'lastTrained', relativeLabel: rel };
  }

  return null;
}
