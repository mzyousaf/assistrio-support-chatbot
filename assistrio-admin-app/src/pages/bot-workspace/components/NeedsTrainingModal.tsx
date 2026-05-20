import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getAdminBotKnowledgePendingTrainingItems } from '@/api/adminApi';
import { ASSISTRIO_WORKSPACE_BOT_REFRESH } from '@/lib/botSyncEvents';
import type {
  AdminPendingTrainingItemsResponse,
  AdminPendingTrainingItemDisplayStatus,
  AdminPendingTrainingSectionType,
} from '../../../api/types';
import { InlineLoader } from '@/components/PageLoader';
import { Button, Modal } from '@/components/ui';
import { KbTrainingStatusTag, KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { isKnowledgePipelinePollingActive, knowledgeTrainingStatusLabel } from '@/lib/knowledgeTrainingStatus';
import { cn } from '@/lib/utils';

function formatLastTrainedAtLabel(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const datePart = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  const timePart = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  return `${datePart} at ${timePart}`;
}

/** Same pills / colors / countdown behavior as KB lists (`KbTrainingStatusTag*` + `knowledgeTrainingStatus`). */
function PendingTrainingRowStatus({
  displayStatus,
  nextRunAfter,
}: {
  displayStatus: AdminPendingTrainingItemDisplayStatus;
  nextRunAfter?: string | null;
}) {
  const ra = typeof nextRunAfter === 'string' && nextRunAfter.trim() ? nextRunAfter.trim() : null;
  const pillClass = 'max-w-full min-w-0 shrink-0 font-normal';

  switch (displayStatus) {
    case 'needs_training':
      return (
        <KbTrainingStatusTag
          className={pillClass}
          label={knowledgeTrainingStatusLabel('pending')}
          statusForBadge="pending"
        />
      );
    case 'scheduled':
      return (
        <KbTrainingStatusTagWithSchedule
          className={pillClass}
          label={knowledgeTrainingStatusLabel('queued')}
          statusForBadge="queued"
          dotCanon="queued"
          row={{ runAfter: ra }}
        />
      );
    case 'failed':
      return (
        <KbTrainingStatusTag
          className={pillClass}
          label={knowledgeTrainingStatusLabel('failed')}
          statusForBadge="failed"
        />
      );
    case 'extraction_failed':
      return (
        <KbTrainingStatusTag
          className={pillClass}
          label="Extraction failed"
          statusForBadge="failed"
        />
      );
    case 'in_training':
      return (
        <KbTrainingStatusTag
          className={pillClass}
          label={knowledgeTrainingStatusLabel('processing')}
          statusForBadge="processing"
        />
      );
    case 'training_queued':
      return ra ? (
        <KbTrainingStatusTagWithSchedule
          className={pillClass}
          label={knowledgeTrainingStatusLabel('queued')}
          statusForBadge="queued"
          dotCanon="queued"
          row={{ runAfter: ra }}
        />
      ) : (
        <KbTrainingStatusTag
          className={pillClass}
          label={knowledgeTrainingStatusLabel('queued')}
          statusForBadge="queued"
        />
      );
    default:
      return (
        <KbTrainingStatusTag className={pillClass} label="Scheduled" statusForBadge="pending" />
      );
  }
}

export type NeedsTrainingModalProps = {
  open: boolean;
  onClose: () => void;
  botId: string | undefined;
  /** Opened while sidebar showed steady “Trained” — copy tweak when empty after load */
  openedFromAllTrained?: boolean;
  /** Optional snapshot from parent; usually omitted so this modal loads GET `/training/pending-items` only when open. */
  prefetched?: AdminPendingTrainingItemsResponse | null;
};

export function NeedsTrainingModal({
  open,
  onClose,
  botId,
  openedFromAllTrained = false,
  prefetched = null,
}: NeedsTrainingModalProps) {
  const { trainingStatus } = useKbWorkspacePolling();
  const [data, setData] = useState<AdminPendingTrainingItemsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<AdminPendingTrainingSectionType | null>(null);
  const pipelineWasActiveRef = useRef(false);

  const load = useCallback(async () => {
    if (!botId) return;
    setError(null);
    setLoading(true);
    const res = await getAdminBotKnowledgePendingTrainingItems(botId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setData(null);
      return;
    }
    setData(res.data);
  }, [botId]);

  useEffect(() => {
    if (prefetched != null) setData(prefetched);
  }, [prefetched]);

  useEffect(() => {
    if (!open || !botId) return;
    if (prefetched == null) {
      setData(null);
      setError(null);
    }
    void load();
  }, [open, botId, load, prefetched]);

  useEffect(() => {
    if (!open || !botId) {
      pipelineWasActiveRef.current = false;
      return;
    }
    const active = isKnowledgePipelinePollingActive(trainingStatus);
    if (pipelineWasActiveRef.current && !active) void load();
    pipelineWasActiveRef.current = active;
  }, [open, botId, load, trainingStatus]);

  useEffect(() => {
    if (!open || !botId) return;
    const onWorkspaceRefresh = (e: Event) => {
      const d = (e as CustomEvent<{ botId?: string }>).detail;
      if (d?.botId === botId) void load();
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
    return () => window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
  }, [open, botId, load]);

  useEffect(() => {
    if (!data?.sections || expanded === null) return;
    const stillExists = data.sections.some((s) => s.type === expanded);
    if (!stillExists) setExpanded(null);
  }, [data, expanded]);

  const toggleSection = (type: AdminPendingTrainingSectionType) => {
    setExpanded((prev) => (prev === type ? null : type));
  };

  const empty = Boolean(data && data.total === 0);
  const hasItems = Boolean(data?.sections?.length);

  const lastTrainedAtLabel = formatLastTrainedAtLabel(trainingStatus?.lastTrainedAt);
  const modalTitle: ReactNode = 'Training status';

  let modalDescription: ReactNode | undefined;
  if (loading) modalDescription = undefined;
  else if (error && !data) modalDescription = 'Check your connection and try again.';
  else if (empty) {
    modalDescription = openedFromAllTrained
      ? 'Your knowledge base matches what has been trained — no action needed here.'
      : 'There is nothing queued for embedding or flagged for fixes in this list.';
  } else if (hasItems) {
    modalDescription = (
      <span>
        Categories group items in training, queued for embedding, waiting on training, or needing a retry. Expand one to
        review titles and each row&apos;s status.
      </span>
    );
  } else modalDescription = undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      description={modalDescription}
      size="lg"
      className={cn(!loading && empty ? 'max-w-md' : 'max-w-lg')}
      footer={
        loading ? undefined : (
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={!botId}>
            Refresh statuses
          </Button>
        )
      }
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto pr-1',
          loading ? 'min-h-[min(320px,50vh)]' : empty ? 'py-1' : 'max-h-[min(70vh,560px)]',
        )}
      >
        {!loading && !error && lastTrainedAtLabel ? (
          <div
            className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/90 px-3 py-2 text-sm text-slate-700"
            role="status"
            aria-live="polite"
          >
            <RefreshCw className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
            <span>
              Last trained at <span className="font-medium">{lastTrainedAtLabel}</span>
            </span>
          </div>
        ) : null}
        {loading ? (
          <InlineLoader title="Fetching pending training items…" className="flex-1 justify-center py-10" />
        ) : error && !data ? (
          <div className="flex flex-col items-center gap-5 px-2 py-6 text-center">
            <p className="m-0 max-w-[22rem] text-sm leading-relaxed text-slate-700">{error}</p>
            <Button type="button" variant="primary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center px-2 pb-6 pt-2 text-center">
            <p className="m-0 max-w-[20rem] text-sm leading-relaxed text-slate-600">
              {openedFromAllTrained
                ? 'When documents or answers change or fail, they will appear here grouped by source type.'
                : 'Open this view after editing knowledge to confirm what still requires training or extraction fixes.'}
            </p>
          </div>
        ) : data?.sections?.length ? (
          <div className="flex flex-col">
            <ul
              className="m-0 list-none divide-y divide-slate-100 rounded-lg border border-slate-200/70 bg-white/90 px-0.5 shadow-none"
              role="list"
            >
              {data.sections.map((sec) => {
                const openSec = expanded === sec.type;
                return (
                  <li key={sec.type} className="rounded-md">
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                        'text-slate-800 hover:bg-sky-50/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/70',
                        openSec && 'bg-sky-50/55',
                      )}
                      aria-expanded={openSec}
                      onClick={() => toggleSection(sec.type)}
                    >
                      <span className="min-w-0 leading-tight">
                        <span className="text-[11px] font-semibold tabular-nums text-sky-800">{sec.count}</span>
                        <span className="text-[11px] font-normal text-slate-400"> · </span>
                        <span className="text-[11px] font-medium text-slate-700">{sec.label}</span>
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {openSec ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                        )}
                      </span>
                    </button>
                    {openSec ? (
                      <ul
                        className="m-0 list-none border-l border-sky-100/95 py-1 pl-2.5 pr-1"
                        role="list"
                      >
                        {sec.items.map((it) => (
                          <li key={it.id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 py-0.5">
                            <span className="min-w-0 flex-1 text-[11px] leading-snug text-slate-700">{it.title.trim()}</span>
                            <PendingTrainingRowStatus displayStatus={it.displayStatus} nextRunAfter={it.nextRunAfter} />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="m-0 px-2 py-4 text-center text-sm text-slate-500">No summary returned from the server.</p>
        )}
      </div>
    </Modal>
  );
}
