import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  deleteCustomerBotKnowledgeItem,
  patchCustomerBotSuggestionHideChipText,
  patchCustomerKnowledgeItemUseInReplies,
  postCustomerKnowledgeSuggestionsSync,
} from '../../../api/customerApi';
import { reportCustomerKnowledgeItemDeleteRejected } from '@/lib/customerKnowledgeItemDelete';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeHideLabelInChatSaveFailed,
  toastKnowledgeHideLabelInChatSaved,
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import {
  kbPlanLimitClientDescription,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
} from '@/lib/knowledgeContentUtf8Limits';
import { TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT } from '@/lib/trainedKnowledgeStorageCopy';
import { tryHandleCustomerResourceGone } from '@/lib/customerResourceUnavailable';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { KnowledgeDeleteConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KnowledgeDetailHideChipTextSwitchRow,
  KnowledgeDetailKbLifecycleTrainingPill,
  KnowledgeDetailTabTitleAccessoryStack,
  KnowledgeDetailUseInRepliesSwitchRow,
  KnowledgeItemDetailPageShell,
  KnowledgeItemTrainingAnalytics,
  KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS,
  KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS,
  useKnowledgeDetailTab,
} from './knowledgeItemDetailShared';
import { KnowledgeManualRetryControl } from './KnowledgeManualRetryControl';
import { KnowledgePlanLimitDetailActions } from '@/components/knowledge/StorageLimitModal';
import { knowledgeRowIndicatesPlanLimitTotal } from '@/lib/knowledgeStorageLimits';
import { EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES } from '../behaviorConstants';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { exampleQuestionsToPatchPayload, hydrateExampleQuestionsFromBot, suggestionListHasScopedKnowledge } from '../exampleQuestionHelpers';
import {
  buildKbPollStuckEscalationTimestamps,
  knowledgePipelineAllowStuckItemDelete,
  knowledgePipelineStuckEligible,
} from '@/lib/knowledgePipelineStuckEscalation';
import {
  formatKnowledgeUtf8BytesDisplay,
  kbDetailLifecyclePresentationFromPollRow,
  suggestionKnowledgeItemStoredUtf8Bytes,
} from './knowledgeViewTypes';
import { KnowledgePipelineStuckEscalationCallout } from './KnowledgePipelineStuckEscalationCallout';
import { KnowledgeItemPrimarySourceAnalytics } from './KnowledgeItemPrimarySourceAnalytics';
import { KnowledgeFieldInfoIcon, KnowledgeHeadingInfoIcon } from './knowledgeFieldInfoIcon';
import { SUGGESTION_DETAIL_TITLE_INFO } from './knowledgeSuggestionPageCopy';
import {
  KB_SUGGESTION_CHIP_FIELD_HELPER,
  KB_SUGGESTION_SCOPE_FIELD_HELPER,
} from '@/lib/knowledgeSuggestionFieldCopy';

export function KnowledgeSuggestionDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const { notifyPlanLimitFromApi } = useKnowledgeStorageUx();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [patchUseInRepliesBusy, setPatchUseInRepliesBusy] = useState(false);
  const [patchHideChipTextBusy, setPatchHideChipTextBusy] = useState(false);
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const row = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();

  const suggestionSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'suggestion'),
    [knowledgeStatusItems],
  );

  const kbPollItem = useMemo(() => {
    if (!row) return null;
    if (!suggestionSlice.length) return null;
    const kid = row.knowledgeItemId?.trim();
    if (kid) return suggestionSlice.find((it) => it.id === kid) ?? null;
    const idx = row.suggestionIndex;
    if (typeof idx === 'number' && Number.isFinite(idx)) {
      return suggestionSlice.find((it) => it.suggestionIndex === idx) ?? null;
    }
    return null;
  }, [row, suggestionSlice]);

  const stuckEscalationTs = useMemo(() => buildKbPollStuckEscalationTimestamps(kbPollItem), [kbPollItem]);
  const stuckEscalationEligible = knowledgePipelineStuckEligible(stuckEscalationTs);
  const stuckAllowsBusyDelete = knowledgePipelineAllowStuckItemDelete(stuckEscalationTs);

  const kbLifecyclePresentation = useMemo(
    () =>
      row
        ? kbDetailLifecyclePresentationFromPollRow({
            sourceType: 'suggestion',
            active: row.active !== false,
            poll: kbPollItem,
            row: {
              trainingStatus: row.trainingStatus,
              displayLabel: row.displayLabel,
              trainingDisplayLabel: row.trainingDisplayLabel,
              displayStatus: row.displayStatus,
              trainingError: row.trainingError,
              kbApiTrainingStatus: row.kbApiTrainingStatus,
            },
          })
        : null,
    [row, kbPollItem],
  );

  const displayCanon = kbLifecyclePresentation?.dotCanon ?? 'pending';

  const detailStatusItemId = (row?.knowledgeItemId ?? kbPollItem?.id ?? '').trim();

  useKbKnowledgeStatusPollInterest(Boolean(botId && row), 'suggestion', detailStatusItemId || undefined);

  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('suggestion', detailStatusItemId || undefined);
  }, [botId, detailStatusItemId, refreshKnowledgeStatus]);

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  async function confirmRemove() {
    if (!botId || !row || numIndex < 0) return;
    if (
      !stuckAllowsBusyDelete &&
      blockIfTrainingForItem(kbPollItem, row, { onAcknowledge: () => setDeleteOpen(false) })
    )
      return;
    setDeleting(true);
    try {
      const itemId = (kbPollItem?.id ?? row.knowledgeItemId)?.trim() ?? '';

      if (itemId) {
        const res = await deleteCustomerBotKnowledgeItem(botId, itemId);
        if (reportCustomerKnowledgeItemDeleteRejected(navigate, res, {
          redirectListOnKbGone: `${base}/suggestions`,
          notifyPlanLimitFromApi,
        })) {
          return;
        }
      } else {
        const next = fromBot.filter((_, i) => i !== numIndex);
        const res = await postCustomerKnowledgeSuggestionsSync(botId, exampleQuestionsToPatchPayload(next));
        if (tryHandleCustomerResourceGone(navigate, res, `${base}/suggestions`)) {
          return;
        }
        if (!res.ok) {
          if (suggestionListHasScopedKnowledge(next) && notifyPlanLimitFromApi(res)) {
            return;
          }
          appToast.error('Could not remove', {
            description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
          });
          return;
        }
      }
      setDeleteOpen(false);
      appToast.success('Suggestion removed');
      await softReload();
      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('suggestion');
      void navigate(`${base}/suggestions`, { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  if (!botId || indexParam === 'new') return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!row) return null;

  const knowledgeItemId = detailStatusItemId;

  async function toggleUseInReplies(next: boolean) {
    if (!botId || !knowledgeItemId) return;
    setPatchUseInRepliesBusy(true);
    try {
      const res = await patchCustomerKnowledgeItemUseInReplies(botId, knowledgeItemId, { useInReplies: next });
      if (!res.ok) {
        toastKnowledgeUseInRepliesSaveFailed(res.error);
        return;
      }
      toastKnowledgeUseInRepliesSaved(next);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
      void refreshKnowledgeStatus('suggestion', detailStatusItemId || undefined);
      void refreshTrainingStatus();
    } finally {
      setPatchUseInRepliesBusy(false);
    }
  }

  async function toggleHideChipTextInChat(next: boolean) {
    if (!botId) return;
    setPatchHideChipTextBusy(true);
    try {
      const res = await patchCustomerBotSuggestionHideChipText(botId, numIndex, { hideChipTextInChat: next });
      if (!res.ok) {
        toastKnowledgeHideLabelInChatSaveFailed(res.error);
        return;
      }
      toastKnowledgeHideLabelInChatSaved(next);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
    } finally {
      setPatchHideChipTextBusy(false);
    }
  }

  const trainingErr = kbPollItem?.trainingError ?? row.trainingError;
  const planLimit = knowledgeRowIndicatesPlanLimitTotal({ trainingError: trainingErr });

  const title = (row.label || `Suggestion ${numIndex + 1}`).trim() || `Suggestion ${numIndex + 1}`;
  const hasScope = Boolean(row.context?.trim());

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Suggestions"
        onBack={() => void navigate(`${base}/suggestions`)}
        sectionLabel="Suggestions"
        itemTitle={title}
        titleSlot={
          <div className="flex min-w-0 flex-wrap items-start gap-1">
            <h1
              className="m-0 line-clamp-2 min-w-0 max-w-full break-words text-lg font-medium leading-tight text-slate-900 sm:text-xl"
              title={title}
            >
              {title}
            </h1>
            <span className="shrink-0 pt-0.5 sm:pt-1">
              <KnowledgeHeadingInfoIcon text={SUGGESTION_DETAIL_TITLE_INFO} ariaLabel="About suggestions" />
            </span>
          </div>
        }
        detailsTabTitleAccessory={
          <KnowledgeDetailTabTitleAccessoryStack
            leading={
              planLimit || (hasScope && kbLifecyclePresentation) ? (
                <KnowledgeDetailKbLifecycleTrainingPill
                  planLimit={planLimit}
                  kbLifecyclePresentation={planLimit ? null : kbLifecyclePresentation}
                  runAfter={kbPollItem?.runAfter ?? row.runAfter ?? null}
                />
              ) : undefined
            }
            trailing={
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <KnowledgeDetailHideChipTextSwitchRow
                  checked={row.hideChipTextInChat === true}
                  disabled={patchHideChipTextBusy || deleting || patchUseInRepliesBusy}
                  onCheckedChange={(next) => void toggleHideChipTextInChat(next)}
                />
                {knowledgeItemId ? (
                  <>
                    <div className="h-6 w-px shrink-0 bg-slate-200" aria-hidden />
                    <KnowledgeDetailUseInRepliesSwitchRow
                      checked={row.active !== false}
                      disabled={patchUseInRepliesBusy || deleting || patchHideChipTextBusy}
                      onCheckedChange={(next) => void toggleUseInReplies(next)}
                    />
                  </>
                ) : null}
              </div>
            }
          />
        }
        breadcrumbInLayout
        onEdit={() => {
          if (blockIfTrainingForItem(kbPollItem, row)) return;
          void navigate('edit', { relative: 'path' });
        }}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        tabContent={
          <div className="flex min-h-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Chip text</h2>
                  <KnowledgeFieldInfoIcon content={KB_SUGGESTION_CHIP_FIELD_HELPER} ariaLabel="About chip text" />
                </div>
                <KnowledgeUtf8Meter
                  value={row.label}
                  maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
                  displayUsedBytes={0}
                  displayFormat="plain"
                />
              </div>
              <div className={KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS}>{row.label.trim() ? row.label : '—'}</div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Scoped content</h2>
                  <KnowledgeFieldInfoIcon content={KB_SUGGESTION_SCOPE_FIELD_HELPER} ariaLabel="About scoped content" />
                </div>
                <KnowledgeUtf8Meter value={row.context ?? ''} maxBytes={EXAMPLE_QUESTION_CONTEXT_MAX_UTF8_BYTES} />
              </div>
              {hasScope ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                  <pre className={KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS}>{row.context.trim()}</pre>
                </div>
              ) : (
                <div className={KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS}>
                  <p className="m-0 text-sm text-slate-500">
                    Not set — first reply after this chip uses the full knowledge base.
                  </p>
                </div>
              )}
            </div>
          </div>
        }
        analyticsContent={
          <>
            <KnowledgeItemTrainingAnalytics
            status={displayCanon}
            lastTrainedAt={kbPollItem?.lastTrainedAt ?? row.lastTrainedAt}
            updatedAt={kbPollItem?.updatedAt ?? null}
            utf8SizeLabel={formatKnowledgeUtf8BytesDisplay(suggestionKnowledgeItemStoredUtf8Bytes(row))}
            statusLabelOverride={planLimit ? TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT : undefined}
            forceFailedStatusDot={planLimit}
            kbLifecyclePresentation={planLimit || !hasScope ? null : kbLifecyclePresentation}
            trainingScheduleRunAfter={null}
            trainingLifecycleRaw={kbPollItem?.status ?? row.trainingStatus ?? null}
            hideTrainingStatus
            hideLastTrained={!hasScope}
            actions={
              <>
                <KnowledgePipelineStuckEscalationCallout
                  eligible={stuckEscalationEligible}
                  displayStatus={kbPollItem?.displayStatus ?? row.displayStatus}
                />
                {planLimit && botId ? (
                  <KnowledgePlanLimitDetailActions botId={botId} className="flex flex-wrap gap-2" />
                ) : null}
                {botId && knowledgeItemId && hasScope ? (
                  <KnowledgeManualRetryControl
                    botId={botId}
                    knowledgeItemId={knowledgeItemId}
                    isLabelOnlySuggestion={false}
                    statusPick={{
                      displayStatus: kbPollItem?.displayStatus,
                      displayMessage: kbPollItem?.displayMessage,
                      lastQueuedAt: kbPollItem?.lastQueuedAt,
                      lastTrainingStartedAt: kbPollItem?.lastTrainingStartedAt,
                      updatedAt: kbPollItem?.updatedAt,
                      trainingError: trainingErr,
                      trainingManualRetrySuggested: kbPollItem?.trainingManualRetrySuggested,
                    }}
                    onAfterSuccess={() => {
                      void refreshKnowledgeStatus('suggestion', detailStatusItemId || undefined);
                      void refreshTrainingStatus();
                      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['suggestion'] });
                    }}
                  />
                ) : null}
              </>
            }
          />
            {botId ? (
              <KnowledgeItemPrimarySourceAnalytics botId={botId} knowledgeItemId={knowledgeItemId || null} />
            ) : null}
          </>
        }
      />
      {trainingGateModal}
      <KnowledgeDeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => void confirmRemove()}
        title="Remove this suggestion?"
        description="This suggestion will be removed from the list right away."
        busy={deleting}
      />
    </>
  );
}
