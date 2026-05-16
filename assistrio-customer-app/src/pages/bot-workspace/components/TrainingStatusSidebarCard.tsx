import { Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getCustomerBotKnowledgeOverview, postCustomerBotRetrainAgent } from '../../../api/customerApi';
import { toastIfTrainQueueRateLimited } from '@/lib/trainQueueRateLimitedToast';
import type { CustomerKnowledgeOverviewResponse, CustomerKnowledgeUsage } from '../../../api/types';
import { Button } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { ASSISTRIO_WORKSPACE_BOT_REFRESH, dispatchKbTrainingStarted } from '@/lib/botSyncEvents';
import {
  hasKnowledgePendingOrQueuedForTrainAction,
  primaryAgentTrainButtonLabelSentence,
} from '@/lib/knowledgeOverviewSources';
import {
  agentSidebarTrainingBucketDotClass,
  agentTrainingPrimaryDotClass,
  isKnowledgePipelinePollingActive,
  resolveAgentSidebarTrainingBucket,
  resolveAgentTrainingHeadlinePhase,
} from '@/lib/knowledgeTrainingStatus';
import { cn } from '@/lib/utils';
import { useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { agentTrainingRichTitle } from './AgentTrainingRichTitle';
import { KnowledgeSourcesModal } from './KnowledgeSourcesModal';
import { NeedsTrainingModal } from './NeedsTrainingModal';
import { KnowledgeStorageUsagePanel } from '@/components/knowledge/KnowledgeStorageUsagePanel';

export type TrainingStatusSidebarCardProps = {
  health: Record<string, unknown> | null;
  botId: string | undefined;
  /**
   * From shell `GET /bots/:id` snapshot (`AppShell` → sidebar). The sidebar renders outside
   * `BotWorkspaceProvider`, so this keeps the storage bar aligned after navbar/shell refetches.
   */
  botKnowledgeUsage?: CustomerKnowledgeUsage | null;
};

/**
 * Sidebar card: agent training from GET `/knowledge/training/status` + Retrain.
 * Headline: green “Train”, primary teal suffix (ing status / trained).
 */
export function TrainingStatusSidebarCard({
  health: _health,
  botId,
  botKnowledgeUsage,
}: TrainingStatusSidebarCardProps) {
  const {
    trainingStatus: agentTs,
    trainingStatusError: agentError,
    refreshTrainingStatus,
    applyAgentTrainingSnapshot,
  } = useKbWorkspacePolling();

  const [overview, setOverview] = useState<CustomerKnowledgeOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [needsTrainingModalOpen, setNeedsTrainingModalOpen] = useState(false);
  const [needsModalOpenedAsTrained, setNeedsModalOpenedAsTrained] = useState(false);
  const [trainBusy, setTrainBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    if (!botId) return;
    setOverviewError(null);
    const res = await getCustomerBotKnowledgeOverview(botId);
    if (!res.ok) {
      setOverviewError(res.error);
      setOverview(null);
      return;
    }
    setOverview(res.data);
  }, [botId]);

  useEffect(() => {
    if (!botId) {
      setOverview(null);
      return;
    }
    setOverviewLoading(true);
    void (async () => {
      await loadOverview();
      setOverviewLoading(false);
    })();
  }, [botId, loadOverview]);

  useEffect(() => {
    if (!botId) return;
    const onWorkspaceRefresh = (e: Event) => {
      const d = (e as CustomEvent<{ botId?: string }>).detail;
      if (d?.botId === botId) {
        void refreshTrainingStatus();
        void loadOverview();
      }
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
    return () => window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
  }, [botId, refreshTrainingStatus, loadOverview]);

  const agentLoading = agentTs === null && !agentError;

  /** Matches backend `GET .../training/status` `counts.pending` (action-needed items). */
  const pendingDisplayTotalResolved = agentTs?.counts.pending ?? 0;

  const phase = agentTs != null ? resolveAgentTrainingHeadlinePhase(agentTs) : null;
  const sidebarBucket = agentTs != null ? resolveAgentSidebarTrainingBucket(agentTs) : null;
  const failedOnlyHeadline = phase === 'failed' && agentTs != null;
  const statusDotClass =
    agentLoading && !agentTs
      ? 'bg-slate-400'
      : failedOnlyHeadline
        ? agentTrainingPrimaryDotClass('failed')
        : sidebarBucket != null
          ? agentSidebarTrainingBucketDotClass(sidebarBucket)
          : 'bg-slate-400';
  /** Steady “all good” headline; failures still need attention → treat like training-status, not trained. */
  const allTrainedHeadline =
    !failedOnlyHeadline && sidebarBucket === 'trained' && agentTs != null;
  /** Accessible plain-language label for the headline control. */
  const headlineAriaLabel = agentLoading
    ? 'Analyzing…'
    : allTrainedHeadline
      ? 'Trained'
      : pendingDisplayTotalResolved > 0
        ? `Training status (${pendingDisplayTotalResolved})`
        : 'Training status';
  const pulseDot =
    agentLoading ||
    (agentTs != null && isKnowledgePipelinePollingActive(agentTs)) ||
    ((sidebarBucket === 'required_training' || sidebarBucket === 'training') && !allTrainedHeadline) ||
    failedOnlyHeadline;

  /**
   * Prefer `agentTs.knowledgeUsage` from `GET …/knowledge/training/status` when present (polled every 5s only while
   * the KB pipeline is active); otherwise shell `GET /bots/:id` and overview.
   */
  const usageResolved = agentTs?.knowledgeUsage ?? botKnowledgeUsage ?? overview?.knowledgeUsage;
  const hideManualRetrain = overview?.knowledgeTraining?.autoTrainEnabled === true;
  const canQueueTrain = hasKnowledgePendingOrQueuedForTrainAction(overview, agentTs);
  const primaryAgentTrainLabel = primaryAgentTrainButtonLabelSentence(overview);

  const retrainBlocked =
    trainBusy ||
    agentLoading ||
    !canQueueTrain ||
    (phase != null && (phase === 'ready' || phase === 'empty') && !agentTs?.hasFailed);

  const onRetrainAgent = useCallback(async () => {
    if (!botId) return;
    setTrainBusy(true);
    try {
      const res = await postCustomerBotRetrainAgent(botId, { includeFailed: true });
      if (!res.ok) {
        if (toastIfTrainQueueRateLimited(res)) return;
        appToast.error('Could not start training', { description: res.error });
        return;
      }
      applyAgentTrainingSnapshot(res.data);
      const affected = res.data.affectedTypes;
      if (affected != null && affected.length > 0) {
        dispatchKbTrainingStarted({ botId, affectedTypes: affected });
      } else {
        dispatchKbTrainingStarted({ botId });
      }
      appToast.success('Training Queued');
    } finally {
      setTrainBusy(false);
    }
  }, [botId, applyAgentTrainingSnapshot]);

  return (
    <>
      <div className="mb-3 w-full max-[900px]:max-w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2.5 shadow-[var(--shadow-xs)]">
        <div className="flex flex-col gap-2.5">
          <div className="border-b border-slate-200/55 pb-2.5">
            <div className="flex flex-col gap-1" role="status" aria-live="polite">
            {agentError && !agentTs ? (
              <p className="m-0 text-xs text-amber-800">{agentError}</p>
            ) : (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <p className="m-0 shrink-0 select-none text-xs font-medium text-slate-400">
                      Your Agent
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        statusDotClass,
                        pulseDot && 'animate-pulse',
                      )}
                      aria-hidden
                    />
                    {agentLoading ? (
                      <span className="text-[10px] font-semibold leading-none">
                        {agentTrainingRichTitle('analyzing')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          'm-0 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] font-semibold leading-snug',
                          'text-teal-900 underline decoration-teal-800/35 underline-offset-2 hover:text-teal-950',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                        disabled={!botId}
                        aria-label={
                          allTrainedHeadline
                            ? `${headlineAriaLabel} — knowledge is up to date`
                            : pendingDisplayTotalResolved > 0
                              ? `View items that need attention (${pendingDisplayTotalResolved})`
                              : 'View training queue and items that need attention'
                        }
                        onClick={() => {
                          setNeedsModalOpenedAsTrained(Boolean(allTrainedHeadline));
                          setNeedsTrainingModalOpen(true);
                        }}
                      >
                        <span className="whitespace-nowrap">
                          {agentTrainingRichTitle(
                            allTrainedHeadline ? 'trained' : 'training_status',
                            pendingDisplayTotalResolved,
                          )}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
            )}
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            {overviewLoading && !overview && !usageResolved ? (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600" aria-hidden />
                <span className="text-[10px] text-slate-500">Loading storage…</span>
              </div>
            ) : usageResolved ? (
              <KnowledgeStorageUsagePanel
                usage={usageResolved}
                variant="compact"
                compactTrailing={
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-0 py-0 text-[10px] font-semibold leading-tight text-teal-700 underline decoration-teal-600/35 underline-offset-2 transition-colors hover:bg-teal-600/10 hover:text-teal-800"
                    disabled={overviewLoading || !botId}
                    onClick={() => {
                      if (botId) void loadOverview();
                      setSourcesOpen(true);
                    }}
                  >
                    View sources
                  </button>
                }
              />
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 py-0 text-xs font-semibold text-teal-700 underline decoration-teal-600/35 underline-offset-2 transition-colors hover:bg-teal-600/10 hover:text-teal-800"
                  disabled={overviewLoading || !botId}
                  onClick={() => {
                    if (botId) void loadOverview();
                    setSourcesOpen(true);
                  }}
                >
                  View sources
                </button>
              </div>
            )}
          </div>

          {!hideManualRetrain ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full gap-1.5"
              disabled={!botId || retrainBlocked}
              title={
                trainBusy
                  ? 'Training…'
                  : retrainBlocked
                    ? !canQueueTrain
                      ? 'Nothing is pending or queued for training'
                      : 'Knowledge is up to date'
                    : 'Queues pending embedding work (scheduling only). Use Retry on a failed row for a fresh extract or train attempt.'
              }
              onClick={() => void onRetrainAgent()}
            >
              {trainBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              )}
              {primaryAgentTrainLabel}
            </Button>
          ) : null}
        </div>
      </div>

      <KnowledgeSourcesModal
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        overview={overview}
        loading={overviewLoading}
        loadError={overviewError}
        botId={botId}
        trainBusy={trainBusy}
        retrainBlocked={retrainBlocked}
        trainBlockedReason={trainBusy ? 'Training…' : retrainBlocked ? 'Knowledge is up to date' : undefined}
        onPrimaryRetrain={() => {
          void (async () => {
            await onRetrainAgent();
            setSourcesOpen(false);
          })();
        }}
      />

      <NeedsTrainingModal
        open={needsTrainingModalOpen}
        onClose={() => {
          setNeedsTrainingModalOpen(false);
          setNeedsModalOpenedAsTrained(false);
        }}
        botId={botId}
        openedFromAllTrained={needsModalOpenedAsTrained}
      />
    </>
  );
}
