import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Maximize2, Pencil, Table2 } from 'lucide-react';
import { deleteCustomerBotKnowledgeItem, patchCustomerKnowledgeItemUseInReplies } from '../../../api/customerApi';
import { KB_DELETE_REQUIRES_SYNC_MESSAGE, reportCustomerKnowledgeItemDeleteRejected } from '@/lib/customerKnowledgeItemDelete';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import { Button } from '@/components/ui';
import { useNotifyKbItemDeletedOnce } from '@/lib/customerResourceUnavailable';
import { TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT } from '@/lib/trainedKnowledgeStorageCopy';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { cn } from '@/lib/utils';
import { ws } from '../workspace';
import { KnowledgeDeleteConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KnowledgeDetailKbLifecycleTrainingPill,
  KnowledgeDetailTabTitleAccessoryStack,
  KnowledgeDetailUseInRepliesSwitchRow,
  KnowledgeItemDetailPageShell,
  KnowledgeItemTrainingAnalytics,
  useKnowledgeDetailTab,
} from './knowledgeItemDetailShared';
import { KnowledgeManualRetryControl } from './KnowledgeManualRetryControl';
import { KnowledgePlanLimitDetailActions } from '@/components/knowledge/StorageLimitModal';
import { knowledgeRowIndicatesPlanLimitTotal } from '@/lib/knowledgeStorageLimits';
import {
  datasheetGridUtf8Bytes,
  datasheetsFromBot,
  formatKnowledgeUtf8BytesDisplay,
  kbDetailLifecyclePresentationFromPollRow,
} from './knowledgeViewTypes';
import {
  isKnowledgeStorageDatasheetViewOnly,
  KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE,
} from '@/lib/knowledgeStorageLimits';
import { useSyncKnowledgeLiveCrumb } from './knowledgeItemRouteLayouts';
import {
  knowledgePipelineAllowStuckItemDelete,
  knowledgePipelineStuckEligible,
  type KnowledgePipelineStuckTimestamps,
} from '@/lib/knowledgePipelineStuckEscalation';
import { KnowledgePipelineStuckEscalationCallout } from './KnowledgePipelineStuckEscalationCallout';
import { KnowledgeItemPrimarySourceAnalytics } from './KnowledgeItemPrimarySourceAnalytics';

const PREVIEW_ROWS = 10;

function DatasheetDetailPreviewOverlay({ onOpenFullscreen }: { onOpenFullscreen: () => void }) {
  return (
    <div className="absolute inset-0 z-[1] min-h-[12rem]">
      <div
        className="absolute inset-0 bg-white/[0.72] backdrop-blur-[2px] backdrop-saturate-[1.05]"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        <div className="h-[18%] min-h-8 shrink-0" aria-hidden />
        <div className="flex w-full shrink-0 justify-center px-2">
          <div
            className="max-w-[22rem] rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 text-center shadow-[0_8px_30px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.05]"
            role="status"
          >
            <div
              className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-teal-600)] text-white shadow-sm"
              aria-hidden
            >
              <Table2 className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <p className="m-0 text-sm font-semibold leading-snug text-slate-900">Edit Datasheet</p>
            <p className={cn(ws.workspaceEditorControlHint, 'mt-1.5 text-pretty')}>
              This is a read-only preview. Open the full-screen editor to work with the full table.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={cn('mt-4 w-full', ws.knowledgeFormActionPrimary)}
              onClick={onOpenFullscreen}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              Edit in full screen
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeDatasheetDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const { notifyPlanLimitFromApi, knowledgeUsage } = useKnowledgeStorageUx();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [patchUseInRepliesBusy, setPatchUseInRepliesBusy] = useState(false);
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  const fromBot = useMemo(() => (bot ? datasheetsFromBot(bot) : []), [bot]);
  const table = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();

  const notifyKbDeleted = useNotifyKbItemDeletedOnce(botId, indexParam);

  const tableSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'table'),
    [knowledgeStatusItems],
  );

  const kbPollItem = useMemo(() => {
    if (!table) return null;
    if (!tableSlice.length) return null;
    const kid = table.knowledgeItemId?.trim();
    if (kid) return tableSlice.find((it) => it.id === kid) ?? null;
    const idx = table.tableIndex;
    if (typeof idx === 'number' && Number.isFinite(idx)) {
      return tableSlice.find((it) => it.tableIndex === idx) ?? null;
    }
    return null;
  }, [table, tableSlice]);

  const pollItemId = table?.knowledgeItemId?.trim() ?? '';

  const stuckEscalationTs = useMemo((): KnowledgePipelineStuckTimestamps => {
    const ds =
      String(kbPollItem?.displayStatus ?? '').trim() ||
      String((table as { displayStatus?: string | null } | null)?.displayStatus ?? '').trim();
    return {
      displayStatus: ds || null,
      lastQueuedAt: kbPollItem?.lastQueuedAt ?? null,
      lastTrainingStartedAt: kbPollItem?.lastTrainingStartedAt ?? null,
      updatedAt: kbPollItem?.updatedAt ?? null,
      createdAt: null,
    };
  }, [kbPollItem, table]);

  const stuckEscalationEligible = knowledgePipelineStuckEligible(stuckEscalationTs);
  const stuckAllowsBusyDelete = knowledgePipelineAllowStuckItemDelete(stuckEscalationTs);

  const kbLifecyclePresentation = useMemo(
    () =>
      table
        ? kbDetailLifecyclePresentationFromPollRow({
            sourceType: 'table',
            poll: kbPollItem,
            row: {
              trainingStatus: table.trainingStatus,
              displayLabel: table.displayLabel,
              trainingDisplayLabel: table.trainingDisplayLabel,
              displayStatus: table.displayStatus,
              trainingError: table.trainingError,
              kbApiTrainingStatus: table.kbApiTrainingStatus,
            },
          })
        : null,
    [table, kbPollItem],
  );

  const displayCanon = kbLifecyclePresentation?.dotCanon ?? 'pending';

  useKbKnowledgeStatusPollInterest(Boolean(botId && table), 'table', pollItemId.trim() || undefined);

  useEffect(() => {
    if (loadState !== 'ok' || !bot) return;
    if (!table) {
      notifyKbDeleted();
      void navigate(`${base}/datasheets`, { replace: true });
    }
  }, [loadState, bot, table, navigate, base, notifyKbDeleted]);

  const datasheetCrumbLabel =
    table != null
      ? ((table.title || `Datasheet ${numIndex + 1}`).trim() || `Datasheet ${numIndex + 1}`)
      : 'Datasheet';
  useSyncKnowledgeLiveCrumb(datasheetCrumbLabel);

  async function confirmRemove() {
    if (!botId || !table || numIndex < 0) return;
    if (
      !stuckAllowsBusyDelete &&
      blockIfTrainingForItem(kbPollItem, table, { onAcknowledge: () => setDeleteOpen(false) })
    )
      return;
    setDeleting(true);
    try {
      const itemId = (kbPollItem?.id ?? table.knowledgeItemId)?.trim() ?? '';

      if (itemId) {
        const res = await deleteCustomerBotKnowledgeItem(botId, itemId);
        if (reportCustomerKnowledgeItemDeleteRejected(navigate, res, {
          redirectListOnKbGone: `${base}/datasheets`,
          notifyPlanLimitFromApi,
        })) {
          return;
        }
      } else {
        appToast.error('Could not remove', { description: KB_DELETE_REQUIRES_SYNC_MESSAGE });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Datasheet removed');
      await softReload();
      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('table');
      void navigate(`${base}/datasheets`, { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  if (!botId) return null;
  if (loadState !== 'ok' || !bot) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }
  if (!table) return null;

  const knowledgeItemId = (kbPollItem?.id ?? table.knowledgeItemId)?.trim() ?? '';

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
      requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
      void refreshKnowledgeStatus('table');
      void refreshTrainingStatus();
    } finally {
      setPatchUseInRepliesBusy(false);
    }
  }

  const trainingErr = kbPollItem?.trainingError ?? table.trainingError;
  const planLimit = knowledgeRowIndicatesPlanLimitTotal({ trainingError: trainingErr });

  const displayTitle = (table.title || `Datasheet ${numIndex + 1}`).trim() || `Datasheet ${numIndex + 1}`;
  const columns = table.columns;
  const storageViewOnly = isKnowledgeStorageDatasheetViewOnly(knowledgeUsage);
  const preview = storageViewOnly ? table.rows : table.rows.slice(0, PREVIEW_ROWS);
  const colSpan = Math.max(1, columns.length);

  return (
    <>
      <KnowledgeItemDetailPageShell
        breadcrumbInLayout
        detailsTabFillHeight
        backLabel="Back to Datasheets"
        onBack={() => void navigate(`${base}/datasheets`)}
        sectionLabel="Datasheets"
        itemTitle={displayTitle}
        titleSlot={
          <h1
            className="m-0 line-clamp-2 min-w-0 max-w-full break-words text-lg font-medium leading-tight text-slate-900 sm:text-xl"
            title={displayTitle}
          >
            {displayTitle}
          </h1>
        }
        detailsTabTitleAccessory={
          <KnowledgeDetailTabTitleAccessoryStack
            leading={
              planLimit || kbLifecyclePresentation ? (
                <KnowledgeDetailKbLifecycleTrainingPill
                  planLimit={planLimit}
                  kbLifecyclePresentation={kbLifecyclePresentation}
                  runAfter={kbPollItem?.runAfter ?? table.runAfter ?? null}
                />
              ) : undefined
            }
            trailing={
              knowledgeItemId ? (
                <KnowledgeDetailUseInRepliesSwitchRow
                  checked={table.active !== false}
                  disabled={storageViewOnly || patchUseInRepliesBusy || deleting}
                  onCheckedChange={(next) => void toggleUseInReplies(next)}
                />
              ) : undefined
            }
          />
        }
        editButtonLabel={storageViewOnly ? 'View in full screen' : undefined}
        EditIcon={storageViewOnly ? Maximize2 : undefined}
        onEdit={() => {
          if (!table) return;
          if (storageViewOnly) {
            void navigate('fullscreen', { relative: 'path' });
            return;
          }
          if (blockIfTrainingForItem(kbPollItem, table)) return;
          void navigate('edit', { relative: 'path' });
        }}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        tabContent={
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
            {storageViewOnly ? (
              <p
                className="m-0 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm leading-snug text-amber-950 sm:px-4"
                role="status"
              >
                {KB_STORAGE_DATASHEET_VIEW_ONLY_MESSAGE}
              </p>
            ) : null}
            {columns.length === 0 ? (
              <p className="m-0 text-sm text-slate-600">This datasheet has no columns yet.</p>
            ) : (
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-100">
                <div
                  className={cn(
                    'relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl',
                    storageViewOnly
                      ? 'overflow-auto overscroll-x-contain overscroll-y-contain'
                      : 'scrollbar-none overflow-x-hidden overflow-y-hidden overscroll-none',
                  )}
                >
                  <table className="w-full min-w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90">
                        <th className="w-10 px-2 py-2 text-center text-xs font-semibold text-slate-500">#</th>
                        {columns.map((c, ci) => (
                          <th
                            key={ci}
                            className="min-w-[100px] max-w-[14rem] whitespace-nowrap px-2 py-2 text-left text-xs font-semibold text-slate-700"
                          >
                            {c.trim() || `Column ${ci + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.length === 0 ? (
                        <tr>
                          <td
                            colSpan={colSpan + 1}
                            className="px-3 py-6 text-center text-sm text-slate-500"
                          >
                            No rows yet
                          </td>
                        </tr>
                      ) : (
                        preview.map((row, ri) => (
                          <tr
                            key={ri}
                            className={cn('border-b border-slate-100', ri % 2 === 1 ? 'bg-slate-50/50' : 'bg-white')}
                          >
                            <td className="px-2 py-2 text-center text-xs font-medium tabular-nums text-slate-500">
                              {ri + 1}
                            </td>
                            {columns.map((_, ci) => (
                              <td key={ci} className="min-w-[100px] max-w-[14rem] px-2 py-2 align-top text-slate-800">
                                <span className="line-clamp-3 break-words [overflow-wrap:anywhere]">
                                  {row[ci] ?? ''}
                                </span>
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {storageViewOnly ? null : (
                    <DatasheetDetailPreviewOverlay
                      onOpenFullscreen={() => void navigate('fullscreen', { relative: 'path' })}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        }
        analyticsContent={
          <>
            <KnowledgeItemTrainingAnalytics
            status={displayCanon}
            lastTrainedAt={kbPollItem?.lastTrainedAt ?? table.lastTrainedAt}
            updatedAt={kbPollItem?.updatedAt ?? null}
            utf8SizeLabel={formatKnowledgeUtf8BytesDisplay(datasheetGridUtf8Bytes(table))}
            statusLabelOverride={planLimit ? TRAINED_KNOWLEDGE_STORAGE_LIMIT_SHORT : undefined}
            forceFailedStatusDot={planLimit}
            kbLifecyclePresentation={planLimit ? null : kbLifecyclePresentation}
            trainingScheduleRunAfter={null}
            trainingLifecycleRaw={kbPollItem?.status ?? table.trainingStatus ?? null}
            hideTrainingStatus
            actions={
              <>
                <KnowledgePipelineStuckEscalationCallout
                  eligible={stuckEscalationEligible}
                  displayStatus={kbPollItem?.displayStatus ?? (table as { displayStatus?: string }).displayStatus}
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
                      void refreshKnowledgeStatus('table');
                      void refreshTrainingStatus();
                      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['table'] });
                      void softReload();
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
        title="Remove this datasheet?"
        description="The datasheet will stop being used for answers right away. You can import again if you change your mind."
        busy={deleting}
      />
    </>
  );
}
