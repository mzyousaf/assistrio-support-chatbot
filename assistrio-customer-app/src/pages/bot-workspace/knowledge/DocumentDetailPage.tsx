import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  deleteCustomerBotDocument,
  getCustomerBotDocument,
  getCustomerBotKnowledgeOverview,
  patchCustomerKnowledgeItemUseInReplies,
} from '../../../api/customerApi';
import { customerDocumentDeleteResolved } from '../../../api/customerDeleteResult';
import type { CustomerKnowledgeStatusItem, CustomerWorkspaceDocument } from '../../../api/types';
import { appToast } from '@/lib/app-toast';
import {
  toastKnowledgeUseInRepliesSaveFailed,
  toastKnowledgeUseInRepliesSaved,
} from '@/lib/knowledgeItemActionToasts';
import { KnowledgeDeleteConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KnowledgeDetailTabTitleAccessoryStack,
  KnowledgeDetailUseInRepliesSwitchRow,
  KnowledgeItemDetailPageShell,
  KnowledgeItemTrainingAnalytics,
  KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS,
  KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS,
  useKnowledgeDetailTab,
} from './knowledgeItemDetailShared';
import { KnowledgeManualRetryControl } from './KnowledgeManualRetryControl';
import { canonicalDocumentKbId } from '@/lib/documentDownload';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import {
  tryHandleCustomerResourceGone,
} from '@/lib/customerResourceUnavailable';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import {
  baselineDocumentRowTrainingStatus,
  mergeDocumentRowCanonicalTrainingStatus,
  normalizeKnowledgeTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';
import { getKnowledgeItemDisplayStatus, workspaceDocumentToDisplayInput } from '@/lib/knowledgeItemDisplayStatus';
import {
  documentKnowledgeItemStoredUtf8Bytes,
  documentRowLastTrainedIso,
  formatDocumentTrainingStatusDisplayLabel,
  formatKnowledgeUtf8BytesDisplay,
  workspaceDocumentPrimaryName,
} from './knowledgeViewTypes';
import type { DocumentRowWithKbMeta } from './knowledgeViewTypes';
import { DocumentKbTrainingStatusTag, DocumentKbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KnowledgePlanLimitDetailActions } from '@/components/knowledge/StorageLimitModal';
import { knowledgeRowIndicatesPlanLimitTotal } from '@/lib/knowledgeStorageLimits';
import { isKnowledgeTrainingBusyError, knowledgeTrainingBusyConflictMessage } from '@/lib/knowledgeTrainingBusyConflict';
import { KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES, KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES } from '@/lib/knowledgeContentUtf8Limits';
import { documentKbManualEditAllowed } from '@/lib/documentKbManualEditGate';
import {
  buildDocumentStuckEscalationTimestamps,
  isoFromUnknownDate,
  knowledgePipelineAllowStuckItemDelete,
  knowledgePipelineStuckEligible,
} from '@/lib/knowledgePipelineStuckEscalation';
import { useSyncKnowledgeLiveCrumb } from './knowledgeItemRouteLayouts';
import { KnowledgePipelineStuckEscalationCallout } from './KnowledgePipelineStuckEscalationCallout';
import { KnowledgeItemPrimarySourceAnalytics } from './KnowledgeItemPrimarySourceAnalytics';

function workspaceDocumentUpdatedIso(d: CustomerWorkspaceDocument | null): string | undefined {
  if (!d) return undefined;
  const u = (d as Record<string, unknown>).updatedAt;
  if (typeof u === 'string' && u.trim()) return u.trim();
  const c = d.createdAt;
  if (typeof c === 'string' && c.trim()) return c.trim();
  return undefined;
}

function documentDetailCanDelete(d: CustomerWorkspaceDocument | null): boolean {
  if (!d) return false;
  if (baselineDocumentRowTrainingStatus(d) === 'ready') return true;
  const up = String((d as { uploadStatus?: unknown }).uploadStatus ?? '').trim().toLowerCase();
  if (up === 'upload_failed') return true;
  if (up && up !== 'uploaded') return false;
  return d.isContentExtracted === true;
}

export function DocumentDetailPage() {
  const { id: botId, docId } = useParams<{ id: string; docId: string }>();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const navigate = useNavigate();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const [tab, setTab] = useKnowledgeDetailTab();
  const [doc, setDoc] = useState<CustomerWorkspaceDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [patchUseInRepliesBusy, setPatchUseInRepliesBusy] = useState(false);
  const [kbPollItem, setKbPollItem] = useState<CustomerKnowledgeStatusItem | null>(null);
  const [autoTrainEnabled, setAutoTrainEnabled] = useState<boolean | null>(null);
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();

  const documentDisplayOpts = useMemo(() => ({ autoTrainEnabled }), [autoTrainEnabled]);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (!botId || !docId) return;
    const silent = opts?.background === true;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    const res = await getCustomerBotDocument(botId, docId);
    if (!res.ok) {
      if (!silent) {
        if (tryHandleCustomerResourceGone(navigate, res, `${base}/documents`)) {
          setDoc(null);
          setLoading(false);
          return;
        }
        setLoadError(res.error);
        setDoc(null);
        setLoading(false);
      }
      return;
    }
    setDoc(res.data.document);
    if (!silent) setLoading(false);
  }, [botId, docId, navigate, base]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setKbPollItem(null);
  }, [docId]);

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    void getCustomerBotKnowledgeOverview(botId).then((res) => {
      if (cancelled || !res.ok) return;
      setAutoTrainEnabled(Boolean(res.data.knowledgeTraining.autoTrainEnabled));
    });
    return () => {
      cancelled = true;
    };
  }, [botId]);

  const detailStatusItemId =
    (doc?.knowledgeItemId && doc.knowledgeItemId.trim()) || (docId ? String(docId).trim() : '') || '';

  useKbKnowledgeStatusPollInterest(Boolean(botId && docId && detailStatusItemId), 'document', detailStatusItemId);

  useEffect(() => {
    if (!botId || !docId || doc == null) return;
    if (!detailStatusItemId) {
      setKbPollItem(null);
      return;
    }
    if (knowledgeStatusItems == null) return;
    const id = String(docId);
    const kid = canonicalDocumentKbId(doc);
    const match =
      knowledgeStatusItems.find((it) => it.documentId === id || it.id === id) ??
      (kid ? knowledgeStatusItems.find((it) => it.id === kid || it.documentId === kid) : undefined);
    setKbPollItem(match ?? null);
  }, [botId, docId, doc, knowledgeStatusItems, detailStatusItemId]);

  const docForTrainingUi = useMemo(() => {
    if (!doc) return null;
    const baseCanon = baselineDocumentRowTrainingStatus(doc);
    const mergedCanon = kbPollItem
      ? mergeDocumentRowCanonicalTrainingStatus(baseCanon, kbPollItem.status, {
          latestIngestJobStatus: kbPollItem.latestIngestJobStatus ?? null,
          extractionStatus: kbPollItem.extractionStatus ?? null,
          displayStatus: kbPollItem.displayStatus ?? null,
          trainingStatus: kbPollItem.trainingStatus ?? null,
        })
      : baseCanon;
    const te = kbPollItem?.trainingError ?? (doc as DocumentRowWithKbMeta).trainingError;
    const ex = kbPollItem?.extractionError ?? doc.extractionError;
    const exSt =
      kbPollItem?.extractionStatus != null && String(kbPollItem.extractionStatus).trim()
        ? String(kbPollItem.extractionStatus).trim()
        : doc.extractionStatus;
    return {
      ...doc,
      ...(kbPollItem != null && typeof kbPollItem.active === 'boolean' ? { active: kbPollItem.active } : {}),
      trainingStatus: mergedCanon,
      ...(exSt != null && String(exSt).trim() ? { extractionStatus: String(exSt).trim() } : {}),
      ...(te != null && String(te).trim() ? { trainingError: String(te).trim() } : {}),
      ...(ex != null && String(ex).trim() ? { extractionError: String(ex).trim() } : {}),
      ...(kbPollItem?.displayLabel != null && String(kbPollItem.displayLabel).trim()
        ? { trainingDisplayLabel: String(kbPollItem.displayLabel).trim() }
        : {}),
      ...(kbPollItem?.displayMessage != null && String(kbPollItem.displayMessage).trim()
        ? { displayMessage: String(kbPollItem.displayMessage).trim() }
        : {}),
      ...(kbPollItem?.displayStatus != null && String(kbPollItem.displayStatus).trim()
        ? { displayStatus: String(kbPollItem.displayStatus).trim() }
        : {}),
      ...(kbPollItem?.isExtracting === true ? { isExtracting: true as const } : {}),
      ...(kbPollItem?.isTraining === true ? { isTraining: true as const } : {}),
      ...(kbPollItem?.isImporting === true ? { isImporting: true as const } : {}),
    } as CustomerWorkspaceDocument;
  }, [doc, kbPollItem]);

  const stuckEscalationTs = useMemo(
    () => buildDocumentStuckEscalationTimestamps({ kbPollItem, doc: docForTrainingUi ?? doc }),
    [kbPollItem, docForTrainingUi, doc],
  );
  const stuckEscalationEligible = knowledgePipelineStuckEligible(stuckEscalationTs);
  const stuckAllowsBusyDelete = knowledgePipelineAllowStuckItemDelete(stuckEscalationTs);

  const kbLifecyclePresentation = useMemo(() => {
    if (!docForTrainingUi) return null;
    const g = getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(docForTrainingUi, documentDisplayOpts));
    return { label: g.label, dotCanon: g.dotCanon };
  }, [docForTrainingUi, documentDisplayOpts]);

  const displayCanon = kbLifecyclePresentation?.dotCanon ?? (doc != null ? baselineDocumentRowTrainingStatus(doc) : 'pending');

  const planLimitDoc = docForTrainingUi ? knowledgeRowIndicatesPlanLimitTotal(docForTrainingUi) : false;
  const trainingErrPick = kbPollItem?.trainingError ?? (doc ? (doc as DocumentRowWithKbMeta).trainingError : undefined);

  const lastTrainedIsoForRow = useMemo(() => {
    if (!docForTrainingUi) return null;
    const merged = {
      ...docForTrainingUi,
      lastTrainedAt: kbPollItem?.lastTrainedAt ?? null,
    };
    return documentRowLastTrainedIso(merged);
  }, [docForTrainingUi, kbPollItem?.lastTrainedAt]);

  async function toggleUseInReplies(next: boolean) {
    if (!botId || !detailStatusItemId) return;
    setPatchUseInRepliesBusy(true);
    try {
      const res = await patchCustomerKnowledgeItemUseInReplies(botId, detailStatusItemId, { useInReplies: next });
      if (!res.ok) {
        toastKnowledgeUseInRepliesSaveFailed(res.error);
        return;
      }
      toastKnowledgeUseInRepliesSaved(next);
      if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
      void refreshKnowledgeStatus('document');
      void refreshTrainingStatus();
      void load({ background: true });
    } finally {
      setPatchUseInRepliesBusy(false);
    }
  }

  async function confirmRemove() {
    if (!botId || !docId) return;
    if (
      !stuckAllowsBusyDelete &&
      docForTrainingUi &&
      blockIfTrainingForItem(kbPollItem, docForTrainingUi, { onAcknowledge: () => setDeleteOpen(false) })
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteCustomerBotDocument(botId, docId);
      if (tryHandleCustomerResourceGone(navigate, res, `${base}/documents`)) {
        return;
      }
      if (!customerDocumentDeleteResolved(res)) {
        if (!res.ok && isKnowledgeTrainingBusyError(res)) {
          appToast.error('Training busy', { description: knowledgeTrainingBusyConflictMessage(res) });
          return;
        }
        appToast.error('Could not remove', { description: !res.ok ? res.error : 'Could not remove' });
        return;
      }
      appToast.success('Document removed');
      setDeleteOpen(false);
      if (botId) {
        requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
      }
      void refreshTrainingStatus();
      void refreshKnowledgeStatus('document');
      void navigate(`${base}/documents`, { replace: true });
    } finally {
      setDeleting(false);
    }
  }

  const title = doc ? workspaceDocumentPrimaryName(doc) : 'Document';
  const text = typeof doc?.text === 'string' ? doc.text : '';
  const canKbManualEdit = doc != null && documentKbManualEditAllowed(doc);

  useSyncKnowledgeLiveCrumb(title);

  if (!botId || !docId) return null;

  return (
    <>
      <KnowledgeItemDetailPageShell
        breadcrumbInLayout
        backLabel="Back to Documents"
        onBack={() => void navigate(`${base}/documents`)}
        sectionLabel="Documents"
        itemTitle={title}
        onEdit={() => {
          if (docForTrainingUi && blockIfTrainingForItem(kbPollItem, docForTrainingUi)) return;
          void navigate('edit', { relative: 'path' });
        }}
        editDisabled={!doc || !canKbManualEdit}
        editDisabledTitle={
          doc && !canKbManualEdit ? 'Editing is available after text extraction finishes.' : undefined
        }
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        hideDelete={!(documentDetailCanDelete(docForTrainingUi ?? doc) || stuckAllowsBusyDelete)}
        detailsTabTitleAccessory={
          <KnowledgeDetailTabTitleAccessoryStack
            leading={
              docForTrainingUi ? (
                planLimitDoc ? (
                  <DocumentKbTrainingStatusTag
                    doc={docForTrainingUi}
                    label={formatDocumentTrainingStatusDisplayLabel(docForTrainingUi, documentDisplayOpts)}
                    documentDisplayOpts={documentDisplayOpts}
                    className="font-normal"
                  />
                ) : kbLifecyclePresentation ? (
                  <DocumentKbTrainingStatusTagWithSchedule
                    doc={docForTrainingUi}
                    label={kbLifecyclePresentation.label}
                    runAfter={kbPollItem?.runAfter ?? (doc as DocumentRowWithKbMeta).runAfter ?? null}
                    trainingCanon={normalizeKnowledgeTrainingStatus(
                      kbLifecyclePresentation.dotCanon ??
                        kbPollItem?.status ??
                        docForTrainingUi.trainingStatus ??
                        null,
                    )}
                    sublineLayout="inline-pipe"
                    className="font-normal"
                    documentDisplayOpts={documentDisplayOpts}
                  />
                ) : (
                  <DocumentKbTrainingStatusTag
                    doc={docForTrainingUi}
                    label={formatDocumentTrainingStatusDisplayLabel(docForTrainingUi, documentDisplayOpts)}
                    documentDisplayOpts={documentDisplayOpts}
                    className="font-normal"
                  />
                )
              ) : undefined
            }
            trailing={
              detailStatusItemId && doc ? (
                <KnowledgeDetailUseInRepliesSwitchRow
                  checked={docForTrainingUi ? docForTrainingUi.active !== false : doc.active !== false}
                  disabled={patchUseInRepliesBusy || deleting || loading}
                  onCheckedChange={(next) => void toggleUseInReplies(next)}
                />
              ) : undefined
            }
          />
        }
        tab={tab}
        onTabChange={setTab}
        busy={loading}
        tabContent={
          loadError ? (
            <p className="m-0 text-sm text-red-600">{loadError}</p>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-6">
              <div className="flex min-h-0 flex-col gap-4">
                <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Document title</h2>
                  <KnowledgeUtf8Meter value={title} maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES} />
                </div>
                <div className={KNOWLEDGE_ITEM_DETAIL_FIELD_BOX_CLASS}>{title.trim() ? title : '—'}</div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
                  <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Document Content</h2>
                  <KnowledgeUtf8Meter value={text} maxBytes={KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES} />
                </div>
                {text.trim() ? (
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                    <pre className={KNOWLEDGE_ITEM_DETAIL_BODY_PRE_CLASS}>{text}</pre>
                  </div>
                ) : (
                  <p className="m-0 text-sm text-slate-600">
                    {!canKbManualEdit
                      ? 'Stored text will appear here after extraction finishes. Editing is available then.'
                      : displayCanon === 'ready'
                        ? 'No content is stored for this file yet, or the document is empty after extraction. Open Edit to add content, or re-upload the file from the list.'
                        : 'Document content appears here as training progresses. You can adjust stored text from Edit.'}
                  </p>
                )}
              </div>
            </div>
          )
        }
        analyticsContent={
          doc ? (
            <>
              <KnowledgeItemTrainingAnalytics
              status={displayCanon}
              lastTrainedAt={lastTrainedIsoForRow}
              updatedAt={kbPollItem?.updatedAt ?? workspaceDocumentUpdatedIso(doc) ?? null}
              utf8SizeLabel={formatKnowledgeUtf8BytesDisplay(
                typeof kbPollItem?.storedTextUtf8Bytes === 'number' &&
                  Number.isFinite(kbPollItem.storedTextUtf8Bytes) &&
                  kbPollItem.storedTextUtf8Bytes > 0
                  ? kbPollItem.storedTextUtf8Bytes
                  : documentKnowledgeItemStoredUtf8Bytes(doc),
              )}
              trainingScheduleRunAfter={null}
              kbLifecyclePresentation={planLimitDoc ? null : kbLifecyclePresentation}
              trainingLifecycleRaw={
                kbPollItem?.status ?? (docForTrainingUi ? String(docForTrainingUi.trainingStatus ?? '') : null)
              }
              hideTrainingStatus
              documentNameUtf8Source={title}
              actions={
                <>
                  <KnowledgePipelineStuckEscalationCallout
                    eligible={stuckEscalationEligible}
                    displayStatus={kbPollItem?.displayStatus ?? docForTrainingUi?.displayStatus}
                  />
                  {planLimitDoc && botId ? (
                    <KnowledgePlanLimitDetailActions botId={botId} className="flex w-full flex-wrap gap-2" />
                  ) : null}
                  {botId && detailStatusItemId ? (
                    <KnowledgeManualRetryControl
                      botId={botId}
                      knowledgeItemId={detailStatusItemId}
                      statusPick={{
                        displayStatus: kbPollItem?.displayStatus ?? (doc as { displayStatus?: string })?.displayStatus,
                        displayMessage: kbPollItem?.displayMessage ?? doc?.displayMessage,
                        lastQueuedAt:
                          kbPollItem?.lastQueuedAt ??
                          (doc as { lastQueuedAt?: string | null }).lastQueuedAt ??
                          null,
                        lastTrainingStartedAt:
                          kbPollItem?.lastTrainingStartedAt ??
                          (doc as { lastTrainingStartedAt?: string | null }).lastTrainingStartedAt,
                        updatedAt: kbPollItem?.updatedAt ?? (doc as { updatedAt?: string | null }).updatedAt,
                        createdAt: isoFromUnknownDate(doc?.createdAt),
                        trainingError: trainingErrPick,
                        extractManualRetrySuggested:
                          kbPollItem?.extractManualRetrySuggested ??
                          (doc as { extractManualRetrySuggested?: boolean }).extractManualRetrySuggested,
                        trainingManualRetrySuggested:
                          kbPollItem?.trainingManualRetrySuggested ??
                          (doc as { trainingManualRetrySuggested?: boolean }).trainingManualRetrySuggested,
                      }}
                      onAfterSuccess={() => {
                        void refreshKnowledgeStatus('document');
                        void refreshTrainingStatus();
                        if (botId) requestWorkspaceBotRefresh(botId, { affectedSections: ['document'] });
                        void load();
                      }}
                    />
                  ) : null}
                </>
              }
            />
              {botId ? (
                <KnowledgeItemPrimarySourceAnalytics botId={botId} knowledgeItemId={canonicalDocumentKbId(doc)} />
              ) : null}
            </>
          ) : (
            <p className="m-0 text-sm text-slate-500">No metadata loaded.</p>
          )
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
        title="Remove this document?"
        description="The file will stop being used for answers right away. You can upload again if you change your mind."
        busy={deleting}
      />
    </>
  );
}
