import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil } from 'lucide-react';
import {
  getCustomerBotDocument,
  getCustomerBotKnowledgeOverview,
  patchCustomerBotDocument,
} from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { tryHandleCustomerResourceGone } from '@/lib/customerResourceUnavailable';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { Button, Input, Textarea } from '@/components/ui';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KnowledgeSaveConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
  KNOWLEDGE_INLINE_TITLE_INPUT_WRAPPER_CLASS,
  KnowledgeItemEditScrollSurface,
} from './knowledgeItemDetailShared';
import { useSyncKnowledgeLiveCrumb, useKnowledgeItemBreadcrumbsHiddenWhile } from './knowledgeItemRouteLayouts';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { CustomerKnowledgeStatusItem, CustomerWorkspaceDocument } from '../../../api/types';
import { canonicalDocumentKbId } from '@/lib/documentDownload';
import { getKnowledgeItemDisplayStatus, workspaceDocumentToDisplayInput } from '@/lib/knowledgeItemDisplayStatus';
import {
  baselineDocumentRowTrainingStatus,
  mergeDocumentRowCanonicalTrainingStatus,
  normalizeKnowledgeTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';
import {
  formatDocumentTrainingStatusDisplayLabel,
  workspaceDocumentPrimaryName,
  type DocumentRowWithKbMeta,
} from './knowledgeViewTypes';
import {
  clampStrUtf8Bytes,
  KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES,
  KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS,
  KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  documentManualUtf8Estimate,
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  knowledgeRowIndicatesPlanLimitTotal,
} from '@/lib/knowledgeStorageLimits';
import { documentKbManualEditAllowed } from '@/lib/documentKbManualEditGate';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { DocumentKbTrainingStatusTag, DocumentKbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';

export function DocumentEditPage() {
  const { id: botId, docId } = useParams<{ id: string; docId: string }>();
  const navigate = useNavigate();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';

  const [doc, setDoc] = useState<CustomerWorkspaceDocument | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [baselineTitle, setBaselineTitle] = useState('');
  const [baselineText, setBaselineText] = useState('');
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipTitleBlurCommitRef = useRef(false);
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false);
  const [saveConflictNotice, setSaveConflictNotice] = useState<string | null>(null);
  const [autoTrainEnabled, setAutoTrainEnabled] = useState<boolean | null>(null);
  const [kbPollItem, setKbPollItem] = useState<CustomerKnowledgeStatusItem | null>(null);
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const documentDisplayOpts = useMemo(() => ({ autoTrainEnabled }), [autoTrainEnabled]);

  const detailStatusItemId =
    (doc?.knowledgeItemId && doc.knowledgeItemId.trim()) || (docId ? String(docId).trim() : '') || '';

  useKbKnowledgeStatusPollInterest(
    Boolean(botId && docId && detailStatusItemId && doc),
    'document',
    detailStatusItemId,
  );

  useEffect(() => {
    setKbPollItem(null);
  }, [docId]);

  useEffect(() => {
    if (!botId || !docId || doc == null) return;
    void refreshKnowledgeStatus('document');
  }, [botId, docId, doc, refreshKnowledgeStatus]);

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

  const kbLifecyclePresentation = useMemo(() => {
    if (!docForTrainingUi) return null;
    const g = getKnowledgeItemDisplayStatus(workspaceDocumentToDisplayInput(docForTrainingUi, documentDisplayOpts));
    return { label: g.label, dotCanon: g.dotCanon };
  }, [docForTrainingUi, documentDisplayOpts]);

  const planLimitDoc = docForTrainingUi ? knowledgeRowIndicatesPlanLimitTotal(docForTrainingUi) : false;

  const docEditTrainingLabel =
    docForTrainingUi && (planLimitDoc || !kbLifecyclePresentation)
      ? formatDocumentTrainingStatusDisplayLabel(docForTrainingUi, documentDisplayOpts)
      : kbLifecyclePresentation?.label ?? '';

  useDismissKnowledgeCompanionModalsOnStorageClose(() => {
    if (saving) return;
    setSaveConflictNotice(null);
    setUpdateConfirmOpen(false);
  });

  const load = useCallback(async () => {
    if (!botId || !docId) return;
    setLoading(true);
    setLoadError(null);
    const res = await getCustomerBotDocument(botId, docId);
    if (!res.ok) {
      if (tryHandleCustomerResourceGone(navigate, res, `${base}/documents`)) {
        setLoading(false);
        return;
      }
      setLoadError(res.error);
      setDoc(null);
    } else {
      const d = res.data.document;
      setDoc(d);
      const primary = workspaceDocumentPrimaryName(d);
      const body = typeof d.text === 'string' ? d.text : '';
      setBaselineTitle(primary);
      setBaselineText(body);
      setTitle(primary);
      setText(body);
    }
    setLoading(false);
  }, [botId, docId, navigate, base]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || !botId || !docId || !doc) return;
    if (!documentKbManualEditAllowed(doc)) {
      appToast.info('Editing is available after text extraction finishes.');
      void navigate('..', { relative: 'path', replace: true });
    }
  }, [loading, botId, docId, doc, base, navigate]);

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

  const displayTitle = (title.trim() || 'Document').trim() || 'Document';

  useSyncKnowledgeLiveCrumb(displayTitle);

  useKnowledgeItemBreadcrumbsHiddenWhile(loading);

  const hasDirtyEdits = useMemo(() => {
    return title.trim() !== baselineTitle.trim() || text !== baselineText;
  }, [title, baselineTitle, text, baselineText]);

  const titleValidForSave = title.trim().length >= KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS;

  useEffect(() => {
    if (!titleEditing) return;
    const el = titleInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [titleEditing]);

  const beginTitleEdit = useCallback(() => {
    setTitleDraft(displayTitle);
    setTitleEditing(true);
  }, [displayTitle]);

  const cancelTitleEdit = useCallback(() => {
    if (saving) return;
    skipTitleBlurCommitRef.current = true;
    setTitleEditing(false);
    queueMicrotask(() => {
      skipTitleBlurCommitRef.current = false;
    });
  }, [saving]);

  const titleDraftTrimmed = titleDraft.trim();
  const titleDraftValid = titleDraftTrimmed.length >= KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS;

  const titleDraftUnchanged = useMemo(() => {
    const current = displayTitle;
    return titleDraftTrimmed === current;
  }, [titleDraftTrimmed, displayTitle]);

  const handleTitleBlur = useCallback(() => {
    if (skipTitleBlurCommitRef.current) return;
    if (saving) return;
    if (!titleDraftValid) {
      setTitleDraft(displayTitle);
      setTitleEditing(false);
      return;
    }
    if (titleDraftTrimmed === displayTitle) {
      setTitleEditing(false);
      return;
    }
    setTitle(titleDraftTrimmed);
    setTitleEditing(false);
  }, [saving, titleDraftValid, titleDraftTrimmed, displayTitle]);

  function requestUpdateChanges() {
    if (!text.trim()) {
      appToast.error('Document content cannot be empty');
      return;
    }
    const t = title.trim();
    if (t.length < KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS) {
      appToast.error('Title too short', {
        description: `Edit the document name (pencil next to the title). It must be at least ${KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS} characters.`,
      });
      return;
    }
    if (botId) {
      void getCustomerBotKnowledgeOverview(botId).then((res) => {
        if (res.ok) setAutoTrainEnabled(Boolean(res.data.knowledgeTraining.autoTrainEnabled));
      });
    }
    setSaveConflictNotice(null);
    setUpdateConfirmOpen(true);
  }

  async function confirmUpdateChanges() {
    if (!botId || !docId) return;
    if (!hasDirtyEdits) {
      setUpdateConfirmOpen(false);
      appToast.info('No changes to save.');
      return;
    }
    const tx = text;
    if (!tx.trim()) {
      setUpdateConfirmOpen(false);
      appToast.error('Document content cannot be empty');
      return;
    }
    const titleForSave = (title.trim() || 'Document').trim() || 'Document';
    const baselineTitleNorm = baselineTitle.trim() || 'Document';
    const delta =
      documentManualUtf8Estimate(titleForSave, tx) - documentManualUtf8Estimate(baselineTitleNorm, baselineText);
    if (!(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))) {
      setUpdateConfirmOpen(false);
      return;
    }
    if (
      docForTrainingUi &&
      blockIfTrainingForItem(kbPollItem, docForTrainingUi, {
        onAcknowledge: () => {
          setUpdateConfirmOpen(false);
          setSaveConflictNotice(null);
        },
      })
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await patchCustomerBotDocument(botId, docId, {
        text: tx,
        title: displayTitle,
      });
      if (tryHandleCustomerResourceGone(navigate, res, `${base}/documents`)) {
        return;
      }
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return;
        }
        if (isKnowledgeTrainingBusyError(res)) {
          setSaveConflictNotice(knowledgeTrainingBusyConflictMessage(res));
          return;
        }
        appToast.error('Could not update document', {
          description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
        });
        return;
      }
      appToast.success(
        autoTrainEnabled === true
          ? 'Document updated. A training run will queue automatically.'
          : autoTrainEnabled === false
            ? 'Document updated. Run Retrain agent from Knowledge Overview when you want this version in replies.'
            : 'Document updated.',
      );
      setSaveConflictNotice(null);
      setUpdateConfirmOpen(false);
      if (botId) {
        requestWorkspaceBotRefresh(botId, { affectedSections: ['document'], refreshDocumentsList: true });
        void refreshKnowledgeStatus('document');
        void refreshTrainingStatus();
      }
      void navigate('..', { relative: 'path', replace: true });
    } finally {
      setSaving(false);
    }
  }

  if (!botId || !docId) return null;

  if (loading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (loadError || !doc) {
    return <p className="m-0 text-sm text-red-600">{loadError ?? 'Document not found.'}</p>;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden" data-knowledge-document-editor>
      <header className="mb-6 flex w-full min-w-0 shrink-0 flex-col gap-3 !mb-0">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(styles.workspaceEditorTitleBlock, 'w-full min-w-0 max-w-[min(100%,42rem)] pb-1')}>
          {titleEditing ? (
            <div className="flex w-full min-w-0 max-w-full flex-col items-stretch gap-1.5">
              <Input
                ref={titleInputRef}
                id="doc-title-inline"
                inputSize="sm"
                wrapperClassName={KNOWLEDGE_INLINE_TITLE_INPUT_WRAPPER_CLASS}
                className="!h-7 min-h-0 py-0 text-base font-medium leading-tight tracking-tight text-slate-900 !px-0 sm:text-lg"
                value={titleDraft}
                invalid={
                  titleDraftTrimmed.length > 0 &&
                  titleDraftTrimmed.length < KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS
                }
                onChange={(e) =>
                  setTitleDraft(clampStrUtf8Bytes(e.target.value, KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES))
                }
                autoComplete="off"
                disabled={saving}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelTitleEdit();
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!titleDraftValid) return;
                    if (titleDraftUnchanged) {
                      setTitleEditing(false);
                      return;
                    }
                    setTitle(titleDraftTrimmed);
                    setTitleEditing(false);
                  }
                }}
              />
              <div className="flex w-full min-w-0 max-w-full flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                <KnowledgeUtf8Meter
                  value={titleDraft}
                  maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES}
                  className="shrink-0"
                />
                <span className="min-w-0 text-xs leading-snug text-slate-500">
                  At least {KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS} character
                  {KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS > 1 ? 's' : ''}. Saved with{' '}
                  <span className="font-medium text-slate-600">Update Changes</span>.
                </span>
              </div>
              {titleDraftTrimmed.length > 0 && titleDraftTrimmed.length < KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS ? (
                <p className="m-0 text-xs text-red-600">
                  Use at least {KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS} character
                  {KNOWLEDGE_DOCUMENT_TITLE_MIN_CHARS > 1 ? 's' : ''}.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex w-full min-w-0 max-w-full flex-col items-start gap-1">
              <div className="flex max-w-full min-w-0 items-end gap-2">
                <h1
                  className={cn(
                    styles.workspaceEditorH1,
                    'm-0 inline-block min-w-0 max-w-[calc(100%-1.75rem)] truncate !leading-tight !tracking-tight',
                  )}
                  title={displayTitle}
                >
                  {displayTitle}
                </h1>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="inline-flex h-5 w-5 shrink-0 items-end justify-center p-0 pb-px text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={beginTitleEdit}
                  disabled={saving}
                  title="Edit document name"
                  aria-label="Edit document name"
                >
                  <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                </Button>
              </div>
              <KnowledgeUtf8Meter value={displayTitle} maxBytes={KNOWLEDGE_ITEM_TITLE_MAX_UTF8_BYTES} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-0.5">
          {hasDirtyEdits ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.knowledgeFormActionSecondary}
              onClick={() => void navigate('..', { relative: 'path' })}
              disabled={saving}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="sm"
            className={styles.knowledgeFormActionPrimary}
            disabled={saving || !hasDirtyEdits || !titleValidForSave}
            onClick={requestUpdateChanges}
            title={
              autoTrainEnabled === null
                ? 'Save edited text to this assistant’s knowledge base.'
                : autoTrainEnabled
                  ? 'Save edits; this action queues training.'
                  : 'Save edits. Run Retrain agent from Knowledge Overview when you want replies to match this.'
            }
          >
            Update Changes
          </Button>
        </div>
        </div>
        {docForTrainingUi ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
            {planLimitDoc ? (
              <DocumentKbTrainingStatusTag
                doc={docForTrainingUi}
                label={docEditTrainingLabel}
                documentDisplayOpts={documentDisplayOpts}
                className="font-normal"
              />
            ) : (
              <DocumentKbTrainingStatusTagWithSchedule
                doc={docForTrainingUi}
                label={docEditTrainingLabel}
                runAfter={kbPollItem?.runAfter ?? (doc as DocumentRowWithKbMeta).runAfter ?? null}
                trainingCanon={normalizeKnowledgeTrainingStatus(
                  kbLifecyclePresentation?.dotCanon ??
                    kbPollItem?.status ??
                    docForTrainingUi.trainingStatus ??
                    null,
                )}
                sublineLayout="inline-pipe"
                className="font-normal"
                documentDisplayOpts={documentDisplayOpts}
              />
            )}
          </div>
        ) : null}
      </header>

      <KnowledgeItemEditScrollSurface layout="fill">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Document Content</p>
            <KnowledgeUtf8Meter value={text} maxBytes={KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Textarea
              id="doc-edit-text"
              quiet
              rows={3}
              className={KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS}
              value={text}
              onChange={(e) =>
                setText(clampStrUtf8Bytes(e.target.value, KNOWLEDGE_DOCUMENT_MANUAL_BODY_MAX_UTF8_BYTES))
              }
              disabled={saving}
              placeholder="Extracted or edited document content…"
            />
          </div>
        </div>
      </KnowledgeItemEditScrollSurface>

      <KnowledgeSaveConfirmModal
        open={updateConfirmOpen}
        onClose={() => {
          if (saving) return;
          setSaveConflictNotice(null);
          setUpdateConfirmOpen(false);
        }}
        onConfirm={() => void confirmUpdateChanges()}
        saveConflictNotice={saveConflictNotice}
        title="Update document?"
        description={
          autoTrainEnabled === null
            ? 'This updates the saved document text for this assistant.'
            : autoTrainEnabled
              ? 'This updates the saved document text and queues training.'
              : 'This updates the saved document text. Run Retrain agent when you want replies to match.'
        }
        bodyNote={
          autoTrainEnabled === null ? (
            <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
              On Knowledge Overview, see whether this save queues training—or use{' '}
              <span className="font-medium text-slate-700">Retrain agent</span> if replies should update now.
            </p>
          ) : autoTrainEnabled ? (
            <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
              Replies use this version after training finishes.
            </p>
          ) : (
            <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
              Replies follow the last trained version until you run{' '}
              <span className="font-medium text-slate-700">Retrain agent</span> on Knowledge Overview.
            </p>
          )
        }
        confirmLabel="Update Changes"
        busyLabel="Updating…"
        busy={saving}
      />
      {trainingGateModal}
    </div>
  );
}
