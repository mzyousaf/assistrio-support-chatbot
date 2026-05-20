import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { tryHandleAdminResourceGone } from '@/lib/adminResourceUnavailable';
import { patchAdminKnowledgeFaq } from '@/api/adminApi';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';
import { appToast } from '@/lib/app-toast';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { useKnowledgeStorageUx, useDismissKnowledgeCompanionModalsOnStorageClose } from '@/context/KnowledgeStorageUxContext';
import { useKbKnowledgeStatusPollInterest, useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import { filterKnowledgeStatusItemsBySection } from '@/lib/knowledgeStatusPollUtils';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeUtf8Meter } from '@/components/knowledge/KnowledgeUtf8Meter';
import { KbTrainingStatusTag, KbTrainingStatusTagWithSchedule } from '@/components/knowledge/KbTrainingStatusTag';
import { KnowledgeSaveConfirmModal, useKnowledgeTrainingGateModal } from './knowledgeSourcesListUi';
import {
  KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS,
  KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
  KnowledgeItemEditScrollSurface,
} from './knowledgeItemDetailShared';
import { cn } from '@/lib/utils';
import {
  clampFaqQuestionLineInCombinedBudget,
  clampFaqQuestionsToCombinedUtf8Budget,
  clampStrUtf8Bytes,
  faqQuestionsCombinedUtf8Bytes,
  KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
  KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES,
  kbPlanLimitClientDescription,
} from '@/lib/knowledgeContentUtf8Limits';
import {
  KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE,
  knowledgeRowIndicatesPlanLimitTotal,
} from '@/lib/knowledgeStorageLimits';
import {
  isKnowledgeTrainingBusyError,
  knowledgeTrainingBusyConflictMessage,
} from '@/lib/knowledgeTrainingBusyConflict';
import { findKnowledgeStatusItemById } from '@/lib/knowledgeTrainingMutationGate';
import { ws as styles } from '../workspace';
import type { QaRow } from './knowledgeViewTypes';
import {
  QA_FORM_IDENTITY_BACKEND_MESSAGE,
  faqsFromBot,
  faqsToPatchPayload,
  kbMergedTrainingStatusChipLabel,
  kbMergedTrainingStatusDotCanon,
  mergeQaRowsWithKbStatusPoll,
  qaFormPassesBackendNormalize,
  qaKnowledgeItemStoredUtf8Bytes,
  workspaceQaPrimaryLabel,
} from './knowledgeViewTypes';
import {
  QaFieldInfoIcon,
  QaHeadingInfoIcon,
  QA_EDIT_PAGE_LEAD,
  QA_EDIT_TITLE_INFO,
  QA_FIELD_ANSWER_HINT,
  QA_FIELD_QUESTIONS_HINT,
  QA_FIELD_TITLE_HINT,
} from './knowledgeQaPageCopy';
import { useSyncKnowledgeLiveCrumb, useKnowledgeItemBreadcrumbsHiddenWhile } from './knowledgeItemRouteLayouts';

function qaEditorPersistFingerprint(row: Pick<QaRow, 'title' | 'questions' | 'answer'>) {
  return JSON.stringify({
    title: String(row.title ?? '').trim(),
    questions: (row.questions ?? []).map((q) => String(q ?? '').trim()).filter(Boolean),
    answer: String(row.answer ?? '').trim(),
  });
}

export function QaEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useAdminBotWorkspace();
  const { notifyPlanLimitFromApi, interceptKnowledgeStorageIncrease } = useKnowledgeStorageUx();
  const { knowledgeStatusItems, refreshKnowledgeStatus, refreshTrainingStatus } = useKbWorkspacePolling();
  const base = botId ? `/bots/${botId}/knowledge` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const faqStatusSlice = useMemo(
    () => filterKnowledgeStatusItemsBySection(knowledgeStatusItems, 'faq'),
    [knowledgeStatusItems],
  );
  const mergedFaqs = useMemo(
    () => mergeQaRowsWithKbStatusPoll(fromBot, faqStatusSlice),
    [fromBot, faqStatusSlice],
  );
  const mergedFaqRow =
    Number.isFinite(numIndex) && numIndex >= 0 && numIndex < mergedFaqs.length ? mergedFaqs[numIndex]! : null;
  const faqPollItemId = (mergedFaqRow?.knowledgeItemId ?? '').trim();
  const { trainingGateModal, blockIfTrainingForItem } = useKnowledgeTrainingGateModal();
  const kbPollForEdit = useMemo(() => {
    if (!faqPollItemId) return null;
    return findKnowledgeStatusItemById(faqStatusSlice, faqPollItemId) ?? null;
  }, [faqStatusSlice, faqPollItemId]);

  useKbKnowledgeStatusPollInterest(
    Boolean(botId && indexParam !== 'new' && mergedFaqRow),
    'faq',
    faqPollItemId || undefined,
  );

  const planLimitTraining = mergedFaqRow
    ? knowledgeRowIndicatesPlanLimitTotal({ trainingError: mergedFaqRow.trainingError })
    : false;
  const [title, setTitle] = useState('');
  const [questionInputs, setQuestionInputs] = useState<string[]>(['']);
  const [answer, setAnswer] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saveConflictNotice, setSaveConflictNotice] = useState<string | null>(null);

  useDismissKnowledgeCompanionModalsOnStorageClose(() => {
    setSaveConfirmOpen(false);
    setSaveConflictNotice(null);
  });

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/faqs`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (!botId || indexParam === 'new') return;
    void refreshKnowledgeStatus('faq', faqPollItemId || undefined);
  }, [botId, indexParam, refreshKnowledgeStatus, faqPollItemId]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return;
    const row = fromBot[numIndex]!;
    setTitle(row.title);
    setQuestionInputs(
      clampFaqQuestionsToCombinedUtf8Budget(row.questions.length > 0 ? [...row.questions] : [''], KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES),
    );
    setAnswer(row.answer);
    setAttempted(false);
  }, [indexParam, numIndex, fromBot, loadState, bot]);

  async function persistFaqs(
    nextFaqs: QaRow[],
    successToast: string,
  ): Promise<{ committed: boolean; trainingBusyMessage?: string }> {
    if (!botId) return { committed: false };
    if (
      mergedFaqRow &&
      blockIfTrainingForItem(kbPollForEdit, mergedFaqRow, {
        onAcknowledge: () => {
          setSaveConfirmOpen(false);
          setSaveConflictNotice(null);
        },
      })
    ) {
      return { committed: false };
    }
    setSaving(true);
    try {
      const payload = faqsToPatchPayload([nextFaqs[numIndex]!])[0];
      if (!payload) {
        appToast.error('Could not save', { description: 'Check that the answer and at least one question or title are filled in.' });
        return { committed: false };
      }
      const res = await patchAdminKnowledgeFaq(botId, numIndex, payload as Record<string, unknown>);
      if (tryHandleAdminResourceGone(navigate, res, `${base}/faqs`)) {
        return { committed: false };
      }
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return { committed: false };
        }
        if (isKnowledgeTrainingBusyError(res)) {
          return {
            committed: false,
            trainingBusyMessage: knowledgeTrainingBusyConflictMessage(res),
          };
        }
        appToast.error('Could not save', {
          description: kbPlanLimitClientDescription(res.errorCode, res.error, res.body),
        });
        return { committed: false };
      }
      appToast.success(successToast);
      await softReload();
      requestWorkspaceBotRefresh(botId, { affectedSections: ['faq'] });
      void refreshKnowledgeStatus('faq', faqPollItemId || undefined);
      void refreshTrainingStatus();
      return { committed: true };
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    setSaveConflictNotice(null);
    setAttempted(true);
    if (!qaFormPassesBackendNormalize(title, questionInputs, answer)) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    if (!qaFormPassesBackendNormalize(title, questionInputs, answer)) {
      setSaveConfirmOpen(false);
      setAttempted(true);
      return;
    }
    const t = title.trim();
    const a = answer.trim();
    const mergedQs = questionInputs.map((q) => q.trim()).filter(Boolean);
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const nextRow: QaRow = { title: t, questions: mergedQs, answer: a, active: fromBot[numIndex]!.active !== false };
    const nextFaqs = fromBot.map((f, i) => (i === numIndex ? nextRow : f));
    const oldRow = fromBot[numIndex]!;
    const delta = qaKnowledgeItemStoredUtf8Bytes(nextRow) - qaKnowledgeItemStoredUtf8Bytes(oldRow);
    if (
      !(await interceptKnowledgeStorageIncrease(delta, KNOWLEDGE_STORAGE_LOW_CONTINUE_DEFAULT_MESSAGE))
    ) {
      setSaveConfirmOpen(false);
      return;
    }
    const outcome = await persistFaqs(nextFaqs, 'Q&A updated');
    if (outcome.trainingBusyMessage) {
      setSaveConflictNotice(outcome.trainingBusyMessage);
      return;
    }
    if (outcome.committed) {
      setSaveConflictNotice(null);
      setSaveConfirmOpen(false);
      setAttempted(false);
      void navigate('..', { relative: 'path' });
    }
  }

  const answerInvalid = attempted && !answer.trim();
  /** Title/questions messaging whenever the bundle fails backend normalize (includes missing answer). */
  const faqIdentityInvalid =
    attempted && !qaFormPassesBackendNormalize(title, questionInputs, answer);

  const baselineFingerprint = useMemo(() => {
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) return null;
    return qaEditorPersistFingerprint(fromBot[numIndex]!);
  }, [numIndex, fromBot]);

  const draftFingerprint = useMemo(
    () => qaEditorPersistFingerprint({ title, questions: questionInputs, answer }),
    [title, questionInputs, answer],
  );

  const hasDirtyEdits = baselineFingerprint != null && draftFingerprint !== baselineFingerprint;
  const saveEnabled =
    hasDirtyEdits && qaFormPassesBackendNormalize(title, questionInputs, answer);

  const editorListBusy =
    Boolean(botId) && indexParam !== 'new' && loadState === 'loading' && !bot;

  useKnowledgeItemBreadcrumbsHiddenWhile(editorListBusy);

  const breadcrumbCrumb = workspaceQaPrimaryLabel(
    { title, questions: questionInputs, answer },
    'Q&A',
  );

  useSyncKnowledgeLiveCrumb(breadcrumbCrumb);

  if (!botId) return null;
  if (indexParam === 'new') return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden" data-knowledge-qa-editor>
      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
              <h1 className={styles.workspaceEditorH1}>Q&amp;A</h1>
              <QaHeadingInfoIcon text={QA_EDIT_TITLE_INFO} ariaLabel="About editing Q and A" />
            </div>
            <p className={styles.workspaceEditorLead}>{QA_EDIT_PAGE_LEAD}</p>
            {mergedFaqRow ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
                {planLimitTraining ? (
                  <KbTrainingStatusTag
                    className="font-normal"
                    label="Storage limit reached"
                    statusForBadge="failed"
                  />
                ) : (
                  <KbTrainingStatusTagWithSchedule
                    label={kbMergedTrainingStatusChipLabel({ ...mergedFaqRow, sourceType: 'faq' })}
                    statusForBadge={kbMergedTrainingStatusDotCanon({ ...mergedFaqRow, sourceType: 'faq' })}
                    row={{ runAfter: mergedFaqRow.runAfter ?? null }}
                    dotCanon={kbMergedTrainingStatusDotCanon({ ...mergedFaqRow, sourceType: 'faq' })}
                    sublineLayout="inline-pipe"
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <KnowledgeItemEditScrollSurface layout="fill">
        <p className={KNOWLEDGE_EDIT_MODE_SECTION_LABEL_CLASS}>Edit Q&amp;A</p>
        <form
          className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            requestSave();
          }}
        >
          <div className="max-h-[min(50vh,26rem)] shrink-0 space-y-5 overflow-y-auto overscroll-contain pr-0.5">
            <FieldRow
              label="Title"
              htmlFor="qa-title"
              labelTrailing={<QaFieldInfoIcon content={QA_FIELD_TITLE_HINT} ariaLabel="About Title" />}
              labelAddon={<KnowledgeUtf8Meter value={title} maxBytes={KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES} />}
              error={faqIdentityInvalid ? QA_FORM_IDENTITY_BACKEND_MESSAGE : undefined}
            >
              <Input
                id="qa-title"
                quiet
                className="w-full min-w-0"
                value={title}
                invalid={faqIdentityInvalid}
                onChange={(e) => setTitle(clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_TITLE_MAX_UTF8_BYTES))}
                autoComplete="off"
                placeholder="Shipping and returns"
              />
            </FieldRow>
            <FieldRow
              label="Questions"
              htmlFor="qa-q-0"
              labelTrailing={<QaFieldInfoIcon content={QA_FIELD_QUESTIONS_HINT} ariaLabel="About Questions" />}
              labelAddon={
                <KnowledgeUtf8Meter
                  value=""
                  displayUsedBytes={faqQuestionsCombinedUtf8Bytes(questionInputs)}
                  maxBytes={KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES}
                />
              }
              error={faqIdentityInvalid ? QA_FORM_IDENTITY_BACKEND_MESSAGE : undefined}
            >
              <div className="space-y-2">
                {questionInputs.map((q, qi) => (
                  <div key={qi} className="flex gap-2">
                    <Input
                      id={qi === 0 ? 'qa-q-0' : undefined}
                      quiet
                      className="min-w-0 flex-1"
                      value={q}
                      invalid={faqIdentityInvalid}
                      onChange={(e) =>
                        setQuestionInputs((prev) =>
                          clampFaqQuestionLineInCombinedBudget(
                            prev,
                            qi,
                            e.target.value,
                            KB_PLAN_FAQ_QUESTION_MAX_UTF8_BYTES,
                          ),
                        )
                      }
                      placeholder={qi === 0 ? 'When do you ship?' : 'Another phrasing…'}
                      autoComplete="off"
                    />
                    {questionInputs.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 px-2"
                        onClick={() =>
                          setQuestionInputs((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== qi) : prev))
                        }
                        aria-label={`Remove question ${qi + 1}`}
                      >
                        <Trash2 size={16} className="text-slate-500" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outlinePrimary"
                  size="md"
                  className="gap-1 font-normal shadow-none"
                  onClick={() => setQuestionInputs((prev) => [...prev, ''])}
                >
                  <Plus size={15} strokeWidth={2} aria-hidden />
                  Add question
                </Button>
              </div>
            </FieldRow>
          </div>
          <FieldRow
            label="Answer"
            htmlFor="qa-answer"
            required
            labelTrailing={<QaFieldInfoIcon content={QA_FIELD_ANSWER_HINT} ariaLabel="About Answer" />}
            labelAddon={<KnowledgeUtf8Meter value={answer} maxBytes={KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES} />}
            error={answerInvalid ? 'Answer is required.' : undefined}
            className="flex min-h-0 flex-1 flex-col"
            controlClassName="flex min-h-0 flex-1 flex-col"
          >
            <Textarea
              id="qa-answer"
              quiet
              rows={3}
              value={answer}
              invalid={answerInvalid}
              onChange={(e) => setAnswer(clampStrUtf8Bytes(e.target.value, KB_PLAN_FAQ_ANSWER_MAX_UTF8_BYTES))}
              className={cn(
                styles.workspaceEditorControlInput,
                KNOWLEDGE_EDITOR_FILL_TEXTAREA_CLASS,
                'py-2.5',
              )}
            />
          </FieldRow>
          <div className={cn(styles.knowledgeFormActionsRow, 'shrink-0')}>
            {hasDirtyEdits ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={styles.knowledgeFormActionSecondary}
                disabled={saving}
                onClick={() => void navigate(`${base}/faqs/${numIndex}`)}
              >
                Cancel
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || !saveEnabled}
              className={styles.knowledgeFormActionPrimary}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </form>
      </KnowledgeItemEditScrollSurface>

      <KnowledgeSaveConfirmModal
        open={saveConfirmOpen}
        onClose={() => {
          setSaveConflictNotice(null);
          setSaveConfirmOpen(false);
        }}
        onConfirm={() => void confirmSave()}
        title="Update Q&A?"
        description="This replaces the saved Q&A for this topic in your assistant’s knowledge base."
        bodyNote={
          <p className={cn(styles.workspaceEditorHelperText, 'm-0')}>
            Replies follow this topic after training completes, depending on your Knowledge Overview settings. You can
            edit it again anytime from this library.
          </p>
        }
        saveConflictNotice={saveConflictNotice}
        confirmLabel="Update"
        busy={saving}
      />
      {trainingGateModal}
    </div>
  );
}
