import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { deleteCustomerBotKnowledgeItem, patchCustomerKnowledgeItemUseInReplies } from '../../../api/customerApi';
import { KB_DELETE_REQUIRES_SYNC_MESSAGE, reportCustomerKnowledgeItemDeleteRejected } from '@/lib/customerKnowledgeItemDelete';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import {
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES,
  faqQuestionsCombinedUtf8Bytes,
} from '@/lib/knowledgeContentUtf8Limits';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import {
  filterKnowledgeStatusItemsBySection,
  resolveFaqPollRow,
} from '@/lib/knowledgeStatusPollUtils';
import { KnowledgeDeleteConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
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
import {
  buildKbPollStuckEscalationTimestamps,
  knowledgePipelineAllowStuckItemDelete,
  knowledgePipelineStuckEligible,
} from '@/lib/knowledgePipelineStuckEscalation';
import {
  faqsFromBot,
  formatKnowledgeUtf8BytesDisplay,
  kbDetailLifecyclePresentationFromPollRow,
  qaKnowledgeItemStoredUtf8Bytes,
  workspaceQaPrimaryLabel,
} from './knowledgeViewTypes';
import { KnowledgePipelineStuckEscalationCallout } from './KnowledgePipelineStuckEscalationCallout';

import {
  QaFieldInfoIcon,
  QaHeadingInfoIcon,
  QA_FIELD_ANSWER_HINT,
  QA_FIELD_QUESTIONS_HINT,
  QA_FIELD_TITLE_HINT,
  QA_LIST_AND_DETAIL_TITLE_INFO,
} from './knowledgeQaPageCopy';

export function QaDetailPage() {
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
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const row = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();

  const faqSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'faq'),
    [knowledgeStatusItems],
  );

  const kbPollItem = useMemo(() => {
    if (!row || !faqSlice.length) return null;
    return resolveFaqPollRow(faqSlice, numIndex, row.knowledgeItemId);
  }, [row, faqSlice, numIndex]);

  const stuckEscalationTs = useMemo(() => buildKbPollStuckEscalationTimestamps(kbPollItem), [kbPollItem]);
  const stuckEscalationEligible = knowledgePipelineStuckEligible(stuckEscalationTs);
  const stuckAllowsBusyDelete = knowledgePipelineAllowStuckItemDelete(stuckEscalationTs);

  const kbLifecyclePresentation = useMemo(
    () =>
      row
        ? kbDetailLifecyclePresentationFromPollRow({
            sourceType: 'faq',
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

  useKbKnowledgeStatusPollInterest(Boolean(botId && row), 'faq', detailStatusItemId || undefined);

  useEffect(() => {
    if (!botId) return;
    void refreshKnowledgeStatus('faq', detailStatusItemId || undefined);
  }, [botId, detailStatusItemId, refreshKnowledgeStatus]);

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
          redirectListOnKbGone: `${base}/faqs`,
          notifyPlanLimitFromApi,
        })) {
          return;
        }
      } else {
        appToast.error('Could not remove', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Q&A removed');
      await softReload();
      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('faq');
      void navigate(`${base}/faqs`, { replace: true });
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
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      void refreshKnowledgeStatus('faq', detailStatusItemId || undefined);
      void refreshTrainingStatus();
    } finally {
      setPatchUseInRepliesBusy(false);
    }
  }

  const trainingErr = kbPollItem?.trainingError ?? row.trainingError;
  const planLimit = knowledgeRowIndicatesPlanLimitTotal({ trainingError: trainingErr });

  const itemHeading = workspaceQaPrimaryLabel(row, `Q&A ${numIndex + 1}`);
  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Q&A"
        onBack={() => void navigate(`${base}/faqs`)}
        sectionLabel="Q&A"
        itemTitle={itemHeading}
        titleSlot={
          <div className="flex min-w-0 flex-wrap items-start gap-1">
            <h1
              className="m-0 line-clamp-2 min-w-0 max-w-full break-words text-lg font-medium leading-tight text-slate-900 sm:text-xl"
              title={itemHeading}
            >
              {itemHeading}
            </h1>
            <span className="shrink-0 pt-0.5 sm:pt-1">
              <QaHeadingInfoIcon text={QA_LIST_AND_DETAIL_TITLE_INFO} ariaLabel="About Q and A" />
            </span>
          </div>
        }
        detailsTabTitleAccessory={
          <KnowledgeDetailTabTitleAccessoryStack
            leading={
              planLimit || kbLifecyclePresentation ? (
                <KnowledgeDetailKbLifecycleTrainingPill
                  planLimit={planLimit}
                  kbLifecyclePresentation={kbLifecyclePresentation}
                  runAfter={kbPollItem?.runAfter ?? row.runAfter ?? null}
                />
              ) : undefined
            }
            trailing={
              knowledgeItemId ? (
                <KnowledgeDetailUseInRepliesSwitchRow
                  checked={row.active !== false}
                  disabled={patchUseInRepliesBusy || deleting}
                  onCheckedChange={(next) => void toggleUseInReplies(next)}
                />
              ) : undefined
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
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Title</h2>
                  <QaFieldInfoIcon content={QA_FIELD_TITLE_HINT} ariaLabel="About Title" />
                </div>
                <KnowledgeUtf8Meter value={row.title} maxBytes={KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES} />
              </div>
              <div className={KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS}>
                {row.title.trim() ? row.title : '—'}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Questions</h2>
                  <QaFieldInfoIcon content={QA_FIELD_QUESTIONS_HINT} ariaLabel="About Questions" />
                </div>
                <KnowledgeUtf8Meter
                  value=""
                  displayUsedBytes={faqQuestionsCombinedUtf8Bytes(row.questions)}
                  maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES}
                />
              </div>
              <div className={KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS}>
                {row.questions.length ? (
                  <ul className="m-0 list-disc space-y-1 pl-5">
                    {row.questions.map((q, qi) => (
                      <li key={qi} className="[overflow-wrap:anywhere] text-sm text-slate-800">
                        {q}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</h2>
                  <QaFieldInfoIcon content={QA_FIELD_ANSWER_HINT} ariaLabel="About Answer" />
                </div>
                <KnowledgeUtf8Meter value={row.answer} maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES} />
              </div>
              {row.answer.trim() ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                  <pre className={KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS}>{row.answer}</pre>
                </div>
              ) : (
                <p className="m-0 text-sm text-slate-600">—</p>
              )}
            </div>
          </div>
        }
        analyticsContent={
          <KnowledgeItemTrainingAnalytics
            status={displayCanon}
            lastTrainedAt={kbPollItem?.lastTrainedAt ?? row.lastTrainedAt}
            updatedAt={kbPollItem?.updatedAt ?? null}
            utf8SizeLabel={formatKnowledgeUtf8BytesDisplay(qaKnowledgeItemStoredUtf8Bytes(row))}
            statusLabelOverride={planLimit ? 'Storage limit reached' : undefined}
            forceFailedStatusDot={planLimit}
            kbLifecyclePresentation={planLimit ? null : kbLifecyclePresentation}
            trainingScheduleRunAfter={null}
            trainingLifecycleRaw={kbPollItem?.status ?? row.trainingStatus ?? null}
            hideTrainingStatus
            actions={
              <>
                <KnowledgePipelineStuckEscalationCallout
                  eligible={stuckEscalationEligible}
                  displayStatus={kbPollItem?.displayStatus ?? row.displayStatus}
                />
                {planLimit && botId ? (
                  <KnowledgePlanLimitDetailActions botId={botId} className="flex flex-wrap gap-2" />
                ) : null}
                {botId && knowledgeItemId ? (
                  <KnowledgeManualRetryControl
                    botId={botId}
                    knowledgeItemId={knowledgeItemId}
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
                      void refreshKnowledgeStatus('faq', detailStatusItemId || undefined);
                      void refreshTrainingStatus();
                      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
                    }}
                  />
                ) : null}
              </>
            }
          />
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
        title="Remove this Q&A?"
        description="This entry will stop being used for answers right away."
        busy={deleting}
      />
    </>
  );
}
