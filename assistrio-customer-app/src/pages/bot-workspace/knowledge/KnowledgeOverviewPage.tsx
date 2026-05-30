import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Clock, Gauge, Layers2, Loader2, Sparkles, Zap } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { toastIfTrainQueueRateLimited } from '@/lib/trainQueueRateLimitedToast';
import {
  ASSISTRIO_WORKSPACE_BOT_REFRESH,
  dispatchKbTrainingStarted,
  requestWorkspaceBotRefresh,
} from '@/lib/botSyncEvents';
import { cn } from '@/lib/utils';
import {
  getCustomerBotKnowledgeOverview,
  patchCustomerBotKnowledgeReplyPriority,
  patchCustomerBotKnowledgeTrainingSettings,
  postCustomerBotRetrainAgent,
} from '../../../api/customerApi';
import type {
  CustomerAgentTrainingDataSourceRow,
  CustomerKnowledgeOverviewResponse,
  KnowledgeReplyPrioritySettings,
  KnowledgeReplyPrioritySourceType,
} from '../../../api/types';
import { Button, Modal, Switch } from '@/components/ui';
import { cardClass } from './knowledgeViewTypes';
import { useKbPollRegistration, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { NeedsTrainingModal } from '../components/NeedsTrainingModal';
import { ws as styles } from '../workspace';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { TRAINED_KNOWLEDGE_STORAGE_HELPER, TRAINED_KNOWLEDGE_STORAGE_LABEL } from '@/lib/trainedKnowledgeStorageCopy';
import {
  hasKnowledgePendingOrQueuedForTrainAction,
  knowledgeSourceRowsFromOverview,
  playgroundSegmentForKnowledgeBucket,
  primaryAgentTrainButtonLabel,
  type KnowledgeSourceBucket,
} from '@/lib/knowledgeOverviewSources';
import { shouldPollAnyKnowledgeSectionFromAgentTrainingStatus } from '@/lib/knowledgeSectionStatusPollGate';
import {
  agentTrainingPrimaryDotClass,
  agentTrainingPrimaryLabelTextClass,
  isKnowledgePipelinePollingActive,
  resolveAgentTrainingHeadlinePhase,
  resolveAgentTrainingHeadlineText,
} from '@/lib/knowledgeTrainingStatus';
import {
  agentTrainingSublineToneClass,
  resolveAgentTrainingPhaseSubline,
} from '@/lib/agentTrainingPhaseSubline';
import { normalizeKnowledgeReplyPriority } from '@/lib/knowledgeReplyPriority';
import {
  REPLY_PRIORITY_SECTION_COPY,
  REPLY_PRIORITY_SOURCE_META,
  reorderPriorityByDrop,
} from '@/lib/knowledgeReplyPrioritySection';
import { KnowledgeStorageUsagePanel } from '@/components/knowledge/KnowledgeStorageUsagePanel';
import { knowledgeOverviewResponseCache } from './knowledgeRouteDataCache';
import { KnowledgeOverviewSkeleton } from './knowledgeScreenSkeletons';
import { KnowledgeTrainingStatusesModal } from './KnowledgeTrainingStatusesModal';
import { useCanManageBot } from '../BotWorkspaceContext';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { PaidPlanFeatureCalloutForReason } from '@/components/billing/PaidPlanFeatureCallout';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import { workspaceAutoTrainAllowed } from '@/lib/planEntitlements';
import { ReadOnlyWorkspaceNotice } from '@/components/workspace/ReadOnlyWorkspaceNotice';

function formatDateTimeLabel(iso: string | null | undefined): string {
  if (typeof iso !== 'string' || !iso.trim()) return 'never';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

function DataSourceTrainingCounts({ row }: { row: CustomerAgentTrainingDataSourceRow | undefined }) {
  if (!row || row.total <= 0) return null;
  const parts: string[] = [];
  if (row.trainingRequired > 0) parts.push(`${row.trainingRequired} need training`);
  if ((row.trainingQueued ?? 0) > 0) parts.push(`${row.trainingQueued} queued`);
  if (row.inTraining > 0) parts.push(`${row.inTraining} in training`);
  if (row.failed > 0) parts.push(`${row.failed} failed`);
  if (row.trained > 0) parts.push(`${row.trained} ready`);
  if (parts.length === 0) return null;
  return (
    <p className="m-0 max-w-full text-right text-xs tabular-nums leading-snug text-slate-600">{parts.join(' · ')}</p>
  );
}

/** Shared shell: white card, consistent radius & shadow (matches KB list cards). */
function overviewCardClass(extra?: string) {
  return cn(cardClass, 'rounded-xl border-slate-200/80', extra);
}

function CardSectionHeader({
  icon: Icon,
  title,
  description,
  accent = 'teal',
  headingId,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: 'teal' | 'slate';
  headingId?: string;
}) {
  const iconWrap =
    accent === 'teal'
      ? 'bg-teal-50 text-teal-700 ring-teal-600/15'
      : 'bg-slate-100 text-slate-600 ring-slate-500/10';
  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
          iconWrap,
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id={headingId} className={styles.workspaceEditorSectionTitle}>
          {title}
        </h2>
        {description ? <p className={styles.workspaceEditorSectionDescription}>{description}</p> : null}
      </div>
    </div>
  );
}

export function KnowledgeOverviewPage() {
  const { id: botId } = useParams<{ id: string }>();
  const canManageBot = useCanManageBot();
  const { customer } = useCustomerAuth();
  const { workspace } = resolveActiveCustomerWorkspace(customer);
  const autoTrainAllowed = workspaceAutoTrainAllowed(workspace);
  const {
    trainingStatus: agentTs,
    trainingStatusError: agentTsError,
    trainingStatusPeekRef,
    kbSectionStatusTrailingTicksRemainingRef,
  } = useKbWorkspacePolling();
  const [data, setData] = useState<CustomerKnowledgeOverviewResponse | null>(() =>
    botId ? knowledgeOverviewResponseCache.get(botId) ?? null : null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => (botId ? !knowledgeOverviewResponseCache.has(botId) : true));
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [replyPriorityBusy, setReplyPriorityBusy] = useState(false);
  const [priorityHowItWorksOpen, setPriorityHowItWorksOpen] = useState(false);
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [priorityDraftOrder, setPriorityDraftOrder] = useState<KnowledgeReplyPrioritySourceType[]>([
    'faq',
    'note',
    'table',
    'document',
    'suggestion',
  ]);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [trainBusy, setTrainBusy] = useState(false);
  const [needsTrainingModalOpen, setNeedsTrainingModalOpen] = useState(false);
  const [trainingStatusesHelpOpen, setTrainingStatusesHelpOpen] = useState(false);
  const [enableAutoTrainModalOpen, setEnableAutoTrainModalOpen] = useState(false);
  const [disableAutoTrainModalOpen, setDisableAutoTrainModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!botId) return;
    setLoadError(null);
    const res = await getCustomerBotKnowledgeOverview(botId);
    if (!res.ok) {
      setLoadError(res.error);
      if (!knowledgeOverviewResponseCache.has(botId)) {
        setData(null);
      }
      return;
    }
    knowledgeOverviewResponseCache.set(botId, res.data);
    setData(res.data);
  }, [botId]);

  useLayoutEffect(() => {
    if (!botId) return;
    const cached = knowledgeOverviewResponseCache.get(botId);
    setData(cached ?? null);
    setLoadError(null);
    setLoading(!cached);
  }, [botId]);

  useEffect(() => {
    if (!botId) return;
    void (async () => {
      await load();
      setLoading(false);
    })();
  }, [botId, load]);

  useEffect(() => {
    if (!botId) return;
    const onWorkspaceRefresh = (e: Event) => {
      const d = (e as CustomEvent<{ botId?: string }>).detail;
      if (d?.botId === botId) void load();
    };
    window.addEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
    return () => window.removeEventListener(ASSISTRIO_WORKSPACE_BOT_REFRESH, onWorkspaceRefresh);
  }, [botId, load]);

  useEffect(() => {
    if (!botId) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [botId, load]);

  useKbPollRegistration(Boolean(botId), {
    id: `kb-overview-${botId ?? ''}`,
    shouldPoll: () => {
      const peek = trainingStatusPeekRef.current ?? undefined;
      return (
        isKnowledgePipelinePollingActive(peek) ||
        shouldPollAnyKnowledgeSectionFromAgentTrainingStatus(peek) ||
        kbSectionStatusTrailingTicksRemainingRef.current > 0
      );
    },
    poll: load,
  });

  const onAutoTrainSwitchIntent = (wantOn: boolean) => {
    if (!botId || !data || !data.knowledgeTraining) return;
    if (wantOn && !autoTrainAllowed) return;
    const current = Boolean(data.knowledgeTraining.autoTrainEnabled);
    if (wantOn === current) return;
    if (wantOn) setEnableAutoTrainModalOpen(true);
    else setDisableAutoTrainModalOpen(true);
  };

  const confirmEnableAutoTrain = async () => {
    if (!botId || !data) return;
    setSettingsBusy(true);
    try {
      const retrainRes = await postCustomerBotRetrainAgent(botId, { includeFailed: true });
      if (!retrainRes.ok) {
        if (!toastIfTrainQueueRateLimited(retrainRes)) {
          appToast.error('Could not queue training', { description: retrainRes.error });
        }
        return;
      }
      const affected = retrainRes.data.affectedTypes;
      if (affected != null && affected.length > 0) {
        dispatchKbTrainingStarted({ botId, affectedTypes: affected });
      } else {
        dispatchKbTrainingStarted({ botId });
      }
      const patchRes = await patchCustomerBotKnowledgeTrainingSettings(botId, { autoTrainEnabled: true });
      if (!patchRes.ok) {
        appToast.error('Training was queued, but Auto Train could not be turned on.', {
          description: patchRes.error,
        });
        setEnableAutoTrainModalOpen(false);
        requestWorkspaceBotRefresh(botId, {
          affectedSections: affected != null && affected.length > 0 ? [...affected] : undefined,
        });
        await load();
        return;
      }
      setData(patchRes.data);
      knowledgeOverviewResponseCache.set(botId, patchRes.data);
      appToast.success('Auto Train enabled. Training Queued.');
      requestWorkspaceBotRefresh(botId, {
        affectedSections: affected != null && affected.length > 0 ? [...affected] : undefined,
      });
      await load();
      setEnableAutoTrainModalOpen(false);
    } finally {
      setSettingsBusy(false);
    }
  };

  const confirmDisableAutoTrain = async () => {
    if (!botId || !data) return;
    setSettingsBusy(true);
    try {
      const patchRes = await patchCustomerBotKnowledgeTrainingSettings(botId, { autoTrainEnabled: false });
      if (!patchRes.ok) {
        appToast.error('Could not update training', { description: patchRes.error });
        return;
      }
      setData(patchRes.data);
      knowledgeOverviewResponseCache.set(botId, patchRes.data);
      appToast.success('Auto Train disabled');
      requestWorkspaceBotRefresh(botId);
      setDisableAutoTrainModalOpen(false);
    } finally {
      setSettingsBusy(false);
    }
  };

  const onTrainOrRetrain = useCallback(async () => {
    if (!botId) return;
    setTrainBusy(true);
    try {
      const res = await postCustomerBotRetrainAgent(botId, { includeFailed: true });
      if (!res.ok) {
        if (toastIfTrainQueueRateLimited(res)) return;
        appToast.error('Could not start training', { description: res.error });
        return;
      }
      const affected = res.data.affectedTypes;
      if (affected != null && affected.length > 0) {
        dispatchKbTrainingStarted({ botId, affectedTypes: affected });
      } else {
        dispatchKbTrainingStarted({ botId });
      }
      appToast.success('Training Queued');
      requestWorkspaceBotRefresh(botId, {
        affectedSections: affected != null && affected.length > 0 ? [...affected] : undefined,
      });
      await load();
    } finally {
      setTrainBusy(false);
    }
  }, [botId, load]);

  const saveReplyPrioritySettings = useCallback(
    async (
      next: KnowledgeReplyPrioritySettings,
      successMessage: string,
    ): Promise<boolean> => {
      if (!botId || !data) return false;
      setReplyPriorityBusy(true);
      try {
        const res = await patchCustomerBotKnowledgeReplyPriority(botId, {
          knowledgeReplyPriority: next,
        });
        if (!res.ok) {
          appToast.error('Could not update reply source priority', { description: res.error });
          return false;
        }
        appToast.success(successMessage);
        await load();
        return true;
      } finally {
        setReplyPriorityBusy(false);
      }
    },
    [botId, data, load],
  );

  const onReplyPriorityModeChange = useCallback(
    async (mode: 'default' | 'priority') => {
      if (!data) return;
      const current = normalizeKnowledgeReplyPriority(data.knowledgeReplyPriority);
      if (current.mode === mode) return;
      const next = { ...current, mode };
      await saveReplyPrioritySettings(next, 'Reply source priority updated');
    },
    [data, saveReplyPrioritySettings],
  );

  const dataSourceTrainingByKey = useMemo(() => {
    const m = new Map<KnowledgeSourceBucket, CustomerAgentTrainingDataSourceRow>();
    for (const d of agentTs?.dataSources ?? []) {
      const k = d.key;
      if (
        k === 'documents' ||
        k === 'snippets' ||
        k === 'qna' ||
        k === 'datasheets' ||
        k === 'suggestions'
      ) {
        m.set(k, d);
      }
    }
    return m;
  }, [agentTs]);
  const replyPriority = normalizeKnowledgeReplyPriority(data?.knowledgeReplyPriority);

  const onPriorityDrop = useCallback(
    async (toIndex: number) => {
      if (dragSourceIndex == null || replyPriorityBusy) return;
      const nextOrder = reorderPriorityByDrop(priorityDraftOrder, dragSourceIndex, toIndex);
      setDragSourceIndex(null);
      setPriorityDraftOrder(nextOrder);
    },
    [dragSourceIndex, priorityDraftOrder, replyPriorityBusy],
  );

  const openPriorityModal = useCallback(() => {
    setPriorityDraftOrder(replyPriority.sourceOrder);
    setPriorityModalOpen(true);
  }, [replyPriority.sourceOrder]);

  const savePriorityDraft = useCallback(async () => {
    const current = normalizeKnowledgeReplyPriority(data?.knowledgeReplyPriority);
    const next = { ...current, sourceOrder: [...priorityDraftOrder] };
    if (next.sourceOrder.join('|') === current.sourceOrder.join('|')) {
      setPriorityModalOpen(false);
      return;
    }
    const ok = await saveReplyPrioritySettings(next, 'Reply priority order saved');
    if (!ok) return;
    setPriorityModalOpen(false);
  }, [data?.knowledgeReplyPriority, priorityDraftOrder, saveReplyPrioritySettings]);

  if (!botId) return null;

  const stats = data?.knowledgeStats;
  const q = data?.queue;
  const tr = data?.knowledgeTraining;

  const canQueueTrain = hasKnowledgePendingOrQueuedForTrainAction(data, agentTs);
  const primaryTrainLabel = primaryAgentTrainButtonLabel(data);
  const hasKbItems = (stats?.totalItems ?? 0) > 0;
  const primaryTrainDisabled =
    !data || trainBusy || !hasKbItems || settingsBusy || !canQueueTrain;

  const agentLoading = agentTs === null && !agentTsError;
  const phase = agentTs != null ? resolveAgentTrainingHeadlinePhase(agentTs) : null;
  const primaryStatusHeadline =
    agentLoading && !agentTs
      ? 'Analyzing…'
      : agentTs != null
        ? resolveAgentTrainingHeadlineText(agentTs)
        : 'Analyzing…';
  const pendingTrainingCount = agentTs?.counts.pending ?? 0;
  const trainingPipelineBusy =
    (agentTs?.counts.queued ?? 0) + (agentTs?.counts.processing ?? 0) > 0;
  const estLabel = (agentTs?.estimatedLabel ?? '').trim();
  const overviewStatusPulse =
    agentLoading ||
    phase === 'training' ||
    phase === 'training_required' ||
    phase === 'importing' ||
    phase === 'extracting';

  const overviewPhaseSubline = resolveAgentTrainingPhaseSubline({
    phase,
    estimatedLabel: estLabel,
    trainingPipelineBusy,
    pendingCount: pendingTrainingCount,
    extractionFailedCount: agentTs?.lifecycleCounts?.extractionFailedCount ?? 0,
    density: 'compact',
    showLastTrainedWhenReady: false,
  });

  const overviewStatusSubline =
    overviewPhaseSubline?.kind === 'text' ? (
      <p
        className={cn(
          'm-0 max-w-xs text-right text-[10px] leading-snug',
          agentTrainingSublineToneClass(overviewPhaseSubline.tone),
        )}
      >
        {overviewPhaseSubline.text}
      </p>
    ) : null;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0 pb-16"
      data-knowledge-overview
    >
      {!canManageBot ? <ReadOnlyWorkspaceNotice variant="knowledge" className="shrink-0" /> : null}
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className={cn(styles.workspaceEditorH1, 'leading-tight')}>Overview</h1>
              <button
                type="button"
                className="m-0 max-w-full shrink-0 border-0 bg-transparent p-0 text-left text-sm font-normal leading-tight text-slate-600 underline decoration-slate-400/80 underline-offset-[3px] transition-colors hover:text-teal-800 hover:decoration-teal-600/55 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
                onClick={() => setTrainingStatusesHelpOpen(true)}
                aria-label="Open guide: how training status works"
              >
                How training status works?
              </button>
            </div>
            <p className={styles.workspaceEditorLead}>
              Approximate trained knowledge storage by source and Auto Train defaults.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:gap-4 sm:pt-0.5">
          <div className="flex min-w-0 flex-col items-end gap-0.5">
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {!agentTsError ? (
                <>
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      agentLoading
                        ? 'animate-pulse bg-slate-400'
                        : phase != null
                          ? agentTrainingPrimaryDotClass(phase)
                          : 'bg-slate-400',
                      overviewStatusPulse && !agentLoading ? 'animate-pulse' : '',
                    )}
                    aria-hidden
                  />
                  {phase === 'training_required' && pendingTrainingCount > 0 ? (
                    <button
                      type="button"
                      className={cn(
                        'm-0 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-left text-xs font-semibold leading-snug',
                        agentTrainingPrimaryLabelTextClass('training_required'),
                        'underline decoration-orange-800/35 underline-offset-2',
                        'hover:text-orange-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/80',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                      disabled={agentLoading || !botId}
                      aria-label={`View items that need training (${pendingTrainingCount})`}
                      onClick={() => setNeedsTrainingModalOpen(true)}
                    >
                      {`Training Required (${pendingTrainingCount})`}
                    </button>
                  ) : (
                    <span
                      className={cn(
                        'shrink-0 text-xs font-semibold leading-snug',
                        agentLoading
                          ? 'text-slate-600'
                          : phase != null
                            ? agentTrainingPrimaryLabelTextClass(phase)
                            : 'text-slate-600',
                      )}
                    >
                      {primaryStatusHeadline}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs text-amber-800">{agentTsError}</span>
              )}
            </div>
            {!agentTsError && overviewStatusSubline}
          </div>
          {canManageBot && data?.knowledgeTraining?.autoTrainEnabled !== true ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={cn(
                styles.knowledgeFormActionPrimary,
                'min-w-[8.5rem] inline-flex items-center justify-center gap-1.5',
              )}
              disabled={primaryTrainDisabled}
              title={
                !hasKbItems
                  ? 'Add knowledge (documents, Q&A, …) before training'
                  : !canQueueTrain
                    ? 'Nothing is pending or queued for training yet'
                    : primaryTrainLabel === 'Retrain Agent'
                      ? 'Queues embedding work for pending or updated knowledge (scheduling only). For a failed row after errors, use Retry on that item for a fresh pipeline attempt.'
                      : 'Queues embedding work for your knowledge (scheduling only). If a row failed, open it and use Retry there for a fresh attempt.'
              }
              onClick={() => void onTrainOrRetrain()}
            >
              {trainBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  <span>Queueing…</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{primaryTrainLabel}</span>
                </>
              )}
            </Button>
          ) : null}
        </div>
      </header>

      {loadError && !data ? (
        <div
          className={cn(
            cardClass,
            'shrink-0 rounded-xl border-amber-200/90 bg-amber-50/80 px-4 py-3 text-sm text-amber-950',
          )}
        >
          {loadError}
        </div>
      ) : null}

      {loading && !data ? (
        <KnowledgeOverviewSkeleton />
      ) : data && stats && q && tr ? (
        <div className={cn(styles.workspaceEditorCardGap, 'min-h-0 w-full min-w-0 flex-1')}>
          {/* Auto train */}
          <section
            className={overviewCardClass(
              'ring-teal-500/[0.12] ring-1',
            )}
            aria-labelledby="overview-auto-train-heading"
          >
            <div className="p-5 sm:p-6">
              <div className="flex gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-600/15"
                  aria-hidden
                >
                  <Zap className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <h2
                      id="overview-auto-train-heading"
                      className={cn(styles.workspaceEditorSectionTitle, 'm-0')}
                    >
                      Auto Train
                    </h2>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={cn(
                          tr.autoTrainEnabled
                            ? styles.workspaceEditorPreviewPillOn
                            : styles.workspaceEditorPreviewPillOff,
                        )}
                      >
                        {tr.autoTrainEnabled ? 'On' : 'Off'}
                      </span>
                      {canManageBot ? (
                      <Switch
                        checked={tr.autoTrainEnabled}
                        onCheckedChange={(next) => onAutoTrainSwitchIntent(next)}
                        disabled={settingsBusy || !autoTrainAllowed}
                        aria-label="Auto Train"
                      />
                      ) : null}
                    </div>
                  </div>
                  <p className={styles.workspaceEditorSectionDescription}>
                    {tr.autoTrainEnabled
                      ? 'New or updated knowledge is queued automatically with smart spacing between retrains.'
                      : 'Changes stay pending until you queue training — use Retrain Agent in the sidebar when you’re ready.'}{' '}
                    Retrain Agent only adjusts scheduling; use Retry on a failed row when you need a fresh extract or train attempt.
                  </p>
                  {!autoTrainAllowed ? (
                    <PaidPlanFeatureCalloutForReason reason="auto_train" compact className="mt-3" />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200/90"
                  aria-hidden
                >
                  <Clock className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-500">Last trained</p>
                  <p className="m-0 mt-0.5 text-base font-semibold tabular-nums tracking-tight text-slate-900">
                    {formatDateTimeLabel(stats.lastTrainedAt)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
          {/* Data sources */}
          <section
            className={cn(overviewCardClass(), 'flex min-h-0 flex-col')}
            aria-labelledby="overview-sources-heading"
          >
            <div className="shrink-0 border-b border-slate-100 p-5 sm:p-6 sm:pb-5">
              <CardSectionHeader
                headingId="overview-sources-heading"
                icon={Layers2}
                accent="slate"
                title="Data sources"
                description="Click a row to open that library. Sizes and training mix per source."
              />
            </div>
            <ul
              className="m-0 flex min-h-0 flex-1 list-none flex-col divide-y divide-slate-100 p-0"
              aria-labelledby="overview-sources-heading"
            >
              {knowledgeSourceRowsFromOverview(data).map((r) => (
                <li key={r.bucket}>
                  <Link
                    to={`/bots/${botId}/playground/knowledgebase/${playgroundSegmentForKnowledgeBucket(r.bucket)}`}
                    className="block rounded-lg outline-none ring-teal-600/40 focus-visible:ring-2"
                  >
                    <div className="flex min-h-[2.75rem] flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
                      <span className="min-w-0 text-sm font-medium leading-snug text-slate-800">{r.label}</span>
                      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,24rem)]">
                        <DataSourceTrainingCounts row={dataSourceTrainingByKey.get(r.bucket)} />
                        <span className="shrink-0 rounded-md bg-slate-100/95 px-1.5 py-px text-[11px] font-medium tabular-nums leading-tight text-slate-700 ring-1 ring-slate-200/80">
                          {formatKnowledgeBytes(r.bytesApprox)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Agent size */}
          <section
            className={cn(overviewCardClass(), 'flex min-h-0 flex-col')}
            aria-labelledby="overview-agent-size-heading"
          >
            <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-6">
              <CardSectionHeader
                headingId="overview-agent-size-heading"
                icon={Gauge}
                accent="slate"
                title={TRAINED_KNOWLEDGE_STORAGE_LABEL}
                description={TRAINED_KNOWLEDGE_STORAGE_HELPER}
              />
              <div className="mt-7 flex min-h-0 flex-1 flex-col sm:mt-8">
                <KnowledgeStorageUsagePanel usage={data?.knowledgeUsage} variant="full" />
              </div>
            </div>
          </section>
          </div>

          <section
            className={overviewCardClass(
              'ring-teal-500/[0.12] ring-1',
            )}
            aria-labelledby="overview-reply-priority-heading"
          >
            <div className="p-5 sm:p-6">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <h2 id="overview-reply-priority-heading" className={cn(styles.workspaceEditorSectionTitle, 'm-0')}>
                    {REPLY_PRIORITY_SECTION_COPY.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      aria-label="How it works for reply source priority"
                      className="border-0 bg-transparent p-0 text-xs font-medium text-teal-700 underline decoration-teal-500/60 underline-offset-2 hover:text-teal-800"
                      onClick={() => setPriorityHowItWorksOpen(true)}
                    >
                      How it works?
                    </button>
                    {canManageBot && replyPriority.mode === 'priority' ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        disabled={replyPriorityBusy}
                        onClick={openPriorityModal}
                      >
                        Edit Priority Order
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p className={cn(styles.workspaceEditorSectionDescription, 'm-0 max-w-3xl')}>
                  Set which sources Assistrio should prefer first when multiple knowledge sources can answer.
                </p>
              </div>

              {canManageBot ? (
              <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <button
                  type="button"
                  aria-label="Select Default ranking"
                  disabled={replyPriorityBusy}
                  onClick={() => void onReplyPriorityModeChange('default')}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                    replyPriority.mode === 'default'
                      ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-400/35'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50',
                    replyPriorityBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-sm font-semibold text-slate-900">{REPLY_PRIORITY_SECTION_COPY.defaultTitle}</p>
                      <p className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {REPLY_PRIORITY_SECTION_COPY.defaultTag}
                      </p>
                    </div>
                    {replyPriority.mode === 'default' ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-3 m-0 text-xs leading-relaxed text-slate-600">
                    {REPLY_PRIORITY_SECTION_COPY.defaultBody}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Select Prioritized ranking"
                  disabled={replyPriorityBusy}
                  onClick={() => void onReplyPriorityModeChange('priority')}
                  className={cn(
                    'rounded-2xl border p-3.5 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60',
                    replyPriority.mode === 'priority'
                      ? 'border-teal-300 bg-teal-50/60 ring-1 ring-teal-400/35'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50',
                    replyPriorityBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-sm font-semibold text-slate-900">{REPLY_PRIORITY_SECTION_COPY.priorityTitle}</p>
                      <p className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {REPLY_PRIORITY_SECTION_COPY.priorityTag}
                      </p>
                    </div>
                    {replyPriority.mode === 'priority' ? (
                      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" aria-hidden />
                    ) : null}
                  </div>
                  <p className="mt-3 m-0 text-xs leading-relaxed text-slate-600">
                    {REPLY_PRIORITY_SECTION_COPY.priorityBody}
                  </p>
                </button>
              </div>
              ) : (
                <p className="mt-4 m-0 text-sm text-slate-600">
                  {replyPriority.mode === 'priority'
                    ? REPLY_PRIORITY_SECTION_COPY.priorityTitle
                    : REPLY_PRIORITY_SECTION_COPY.defaultTitle}{' '}
                  ranking is active.
                </p>
              )}

              <div className="mt-2.5 min-h-1" />

              {replyPriority.mode === 'default' ? (
                <div className="mt-1" />
              ) : (
                <>
                  <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-3 sm:p-4">
                    <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Current priority order
                    </p>
                    <div className="space-y-1.5">
                    {replyPriority.sourceOrder.map((key, index) => {
                      const card = REPLY_PRIORITY_SOURCE_META.find((x) => x.key === key);
                      if (!card) return null;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="m-0 text-sm font-medium text-slate-900">
                              {index + 1}. {card.label}
                            </p>
                            <p className="m-0 text-xs text-slate-600">{card.description}</p>
                          </div>
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500"
                            aria-hidden
                            title="Drag handle"
                          >
                            ⋮⋮
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </>
              )}
            </div>
          </section>
          <div className="h-6 shrink-0" aria-hidden />
        </div>
      ) : null}

      <Modal
        open={enableAutoTrainModalOpen}
        onClose={() => {
          if (!settingsBusy) setEnableAutoTrainModalOpen(false);
        }}
        title={
          <span className="inline-flex items-center gap-2">
            <Zap size={18} strokeWidth={2} className="text-teal-600" aria-hidden />
            <span>Turn on Auto Train?</span>
          </span>
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={settingsBusy}
              onClick={() => setEnableAutoTrainModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={styles.knowledgeFormActionPrimary}
              disabled={settingsBusy}
              onClick={() => void confirmEnableAutoTrain()}
            >
              {settingsBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Working…
                </>
              ) : (
                'Turn on & queue training'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-0">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">How it works</p>
          <ul className="m-0 list-none space-y-2 p-0 text-sm leading-relaxed text-slate-600">
            <li className="flex gap-2">
              <span className="text-teal-600 tabular-nums" aria-hidden>
                1.
              </span>
              <span>
                We catch up whatever is waiting or retrying—same as{' '}
                <strong className="font-medium text-slate-700">Retrain Agent</strong>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600 tabular-nums" aria-hidden>
                2.
              </span>
              <span>After that, new saves queue for training on their own—no extra steps.</span>
            </li>
          </ul>
        </div>
      </Modal>

      <Modal
        open={disableAutoTrainModalOpen}
        onClose={() => {
          if (!settingsBusy) setDisableAutoTrainModalOpen(false);
        }}
        title="Turn off Auto Train?"
        tone="warning"
        description={
          <span className="text-sm leading-relaxed text-slate-600">
            New knowledge edits will stay pending until you use <strong>Retrain Agent</strong> manually.
          </span>
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={settingsBusy}
              onClick={() => setDisableAutoTrainModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={settingsBusy}
              onClick={() => void confirmDisableAutoTrain()}
            >
              {settingsBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Working…
                </>
              ) : (
                'Turn off Auto Train'
              )}
            </Button>
          </div>
        }
      >
        {null}
      </Modal>

      <NeedsTrainingModal
        open={needsTrainingModalOpen}
        onClose={() => setNeedsTrainingModalOpen(false)}
        botId={botId}
      />

      <KnowledgeTrainingStatusesModal
        open={trainingStatusesHelpOpen}
        onClose={() => setTrainingStatusesHelpOpen(false)}
      />

      <Modal
        open={priorityModalOpen}
        onClose={() => {
          if (!replyPriorityBusy) {
            setPriorityModalOpen(false);
            setDragSourceIndex(null);
          }
        }}
        title="Set reply source priority"
        description="Drag and drop rows to set your preferred source order."
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={replyPriorityBusy}
              onClick={() => {
                setPriorityModalOpen(false);
                setDragSourceIndex(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={replyPriorityBusy}
              onClick={() => void savePriorityDraft()}
            >
              {replyPriorityBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                'Save order'
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
            Assistrio still picks the most relevant answer. Priority is used when multiple sources are similarly relevant.
          </div>
          <div className="space-y-2">
          {priorityDraftOrder.map((key, index) => {
            const row = REPLY_PRIORITY_SOURCE_META.find((s) => s.key === key);
            if (!row) return null;
            return (
              <div
                key={key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors',
                  replyPriorityBusy ? '' : 'hover:border-slate-300 hover:bg-slate-50/40',
                )}
                draggable={!replyPriorityBusy}
                onDragStart={(e) => {
                  setDragSourceIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (!replyPriorityBusy) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void onPriorityDrop(index);
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-medium text-slate-900">
                    {index + 1}. {row.label}
                  </p>
                  <p className="m-0 text-xs text-slate-600">{row.description}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Drag ${row.label} to reorder`}
                  disabled={replyPriorityBusy}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </button>
              </div>
            );
          })}
          </div>
        </div>
      </Modal>

      <Modal
        open={priorityHowItWorksOpen}
        onClose={() => setPriorityHowItWorksOpen(false)}
        title="How Reply Source Priority Works"
        footer={
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setPriorityHowItWorksOpen(false)}
            >
              Got it
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p className="m-0 mb-3">
            Assistrio always checks relevance first. Source priority helps only when multiple sources are similarly relevant.
          </p>
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-3">
            <p className="m-0 font-medium text-slate-900">Default ranking</p>
            <p className="m-0 mt-1 text-slate-700">
              Assistrio chooses the best matching answer automatically, without using custom source order.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-3">
            <p className="m-0 font-medium text-slate-900">Prioritized ranking</p>
            <p className="m-0 mt-1 text-slate-700">
              Assistrio uses your source order only when two or more sources are similarly relevant. It does not force an answer from Priority 1. If a higher-priority source has weak or irrelevant evidence, Assistrio continues through lower-priority sources and still returns the strongest answer.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
