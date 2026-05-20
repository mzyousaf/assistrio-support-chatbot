import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import type { AdminKnowledgeOverviewResponse } from '../../../api/types';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { AGENT_KNOWLEDGE_CAP_BYTES } from '@/lib/agentKnowledgeLimits';
import {
  playgroundSegmentForKnowledgeBucket,
  primaryAgentTrainButtonLabelSentence,
  knowledgeSourceRowsFromOverview,
} from '@/lib/knowledgeOverviewSources';

export type KnowledgeSourcesModalBodyProps = {
  overview: AdminKnowledgeOverviewResponse | null;
  loading: boolean;
  loadError: string | null;
  botId: string | undefined;
  /** Closed after following a playground link */
  onAfterNavigate?: () => void;
};

/** Shared list used by {@link KnowledgeSourcesModal} and training sidebar detail modal. */
export function KnowledgeSourcesModalBody({
  overview,
  loading,
  loadError,
  botId,
  onAfterNavigate,
}: KnowledgeSourcesModalBodyProps) {
  const stats = overview?.knowledgeStats;
  const rows = overview ? knowledgeSourceRowsFromOverview(overview) : [];
  const totalChars = stats?.totalCharacters ?? 0;

  if (loading && !overview) {
    return (
      <div className="flex justify-center py-10 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
      </div>
    );
  }
  if (loadError && !overview) {
    return <p className="m-0 text-sm text-amber-800">{loadError}</p>;
  }
  if (stats && overview) {
    return (
      <div className="flex flex-col gap-1">
        <ul className="m-0 list-none space-y-0 p-0">
          {rows.map((r) => (
            <li key={r.label} className="border-b border-slate-100 py-2.5 last:border-0">
              {botId ? (
                <Link
                  to={`/bots/${encodeURIComponent(botId)}/knowledge/${encodeURIComponent(playgroundSegmentForKnowledgeBucket(r.bucket))}`}
                  onClick={() => onAfterNavigate?.()}
                  className="flex items-baseline justify-between gap-3 rounded-md text-inherit outline-none ring-teal-600/40 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2"
                >
                  <span className="text-sm text-slate-800">{r.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-600">
                    {formatKnowledgeBytes(r.bytesApprox)}
                  </span>
                </Link>
              ) : (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-slate-800">{r.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-600">
                    {formatKnowledgeBytes(r.bytesApprox)}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200/80 pt-3">
          <span className="text-sm font-semibold text-slate-900">Total size</span>
          <span className="text-sm tabular-nums text-slate-800">
            {formatKnowledgeBytes(totalChars)}
            <span className="text-slate-400"> / </span>
            {formatKnowledgeBytes(AGENT_KNOWLEDGE_CAP_BYTES)}
          </span>
        </div>
      </div>
    );
  }
  return <p className="m-0 text-sm text-slate-500">No data.</p>;
}

export type KnowledgeSourcesModalProps = {
  open: boolean;
  onClose: () => void;
  overview: AdminKnowledgeOverviewResponse | null;
  loading: boolean;
  loadError: string | null;
  botId: string | undefined;
  trainBusy: boolean;
  retrainBlocked: boolean;
  trainBlockedReason?: string;
  onPrimaryRetrain: () => void;
};

export function KnowledgeSourcesModal({
  open,
  onClose,
  overview,
  loading,
  loadError,
  botId,
  trainBusy,
  retrainBlocked,
  trainBlockedReason,
  onPrimaryRetrain,
}: KnowledgeSourcesModalProps) {
  const footerTrainLabel = primaryAgentTrainButtonLabelSentence(overview);
  const hidePrimaryRetrain = overview?.knowledgeTraining?.autoTrainEnabled === true;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnBackdropClick
      title="Data sources"
      description="Click a source to open its library. Sizes are approximate (character-based)."
      size="lg"
      className="max-w-md"
      footer={
        hidePrimaryRetrain ? undefined : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="inline-flex min-w-[7.5rem] items-center gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
            disabled={!botId || retrainBlocked}
            title={trainBlockedReason}
            onClick={onPrimaryRetrain}
          >
            {trainBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            )}
            {footerTrainLabel}
          </Button>
        )
      }
    >
      <KnowledgeSourcesModalBody
        overview={overview}
        loading={loading}
        loadError={loadError}
        botId={botId}
        onAfterNavigate={onClose}
      />
    </Modal>
  );
}
