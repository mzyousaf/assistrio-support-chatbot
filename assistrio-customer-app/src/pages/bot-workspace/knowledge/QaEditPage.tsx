import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeBackBreadcrumbRow, KnowledgeSaveConfirmModal } from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { QaRow } from './knowledgeViewTypes';
import { faqsFromBot, faqsToPatchPayload } from './knowledgeViewTypes';

export function QaEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const [title, setTitle] = useState('');
  const [questionInputs, setQuestionInputs] = useState<string[]>(['']);
  const [answer, setAnswer] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/faqs`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      void navigate(`${base}/faqs`, { replace: true });
      return;
    }
    const row = fromBot[numIndex]!;
    setTitle(row.title);
    setQuestionInputs(row.questions.length > 0 ? [...row.questions] : ['']);
    setAnswer(row.answer);
    setAttempted(false);
  }, [indexParam, numIndex, fromBot, loadState, bot, navigate, base]);

  async function persistFaqs(nextFaqs: QaRow[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    setSaving(true);
    try {
      const res = await patchCustomerBot(botId, { faqs: faqsToPatchPayload(nextFaqs) });
      if (!res.ok) {
        appToast.error('Could not save', { description: res.error });
        return false;
      }
      appToast.success(successToast);
      await softReload();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function requestSave() {
    setAttempted(true);
    const t = title.trim();
    const a = answer.trim();
    const mergedQs = questionInputs.map((q) => q.trim()).filter(Boolean);
    if (!t || mergedQs.length === 0 || !a) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    const t = title.trim();
    const a = answer.trim();
    const mergedQs = questionInputs.map((q) => q.trim()).filter(Boolean);
    if (!t || mergedQs.length === 0 || !a) {
      setSaveConfirmOpen(false);
      setAttempted(true);
      return;
    }
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const nextRow: QaRow = { title: t, questions: mergedQs, answer: a, active: true };
    const nextFaqs = fromBot.map((f, i) => (i === numIndex ? nextRow : f));
    const ok = await persistFaqs(nextFaqs, 'Q&A updated');
    if (ok) {
      setSaveConfirmOpen(false);
      setAttempted(false);
      void navigate(`${base}/faqs/${numIndex}`, { replace: true });
    }
  }

  const titleInvalid = attempted && !title.trim();
  const questionsInvalid = attempted && !questionInputs.some((x) => x.trim());
  const answerInvalid = attempted && !answer.trim();

  if (!botId) return null;
  if (indexParam === 'new') return null;

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-qa-editor
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel="Back"
          onBack={() => void navigate(`${base}/faqs/${numIndex}`)}
          sectionLabel="Q&A"
          lastCrumb={title.trim() || 'Q&A'}
          tailLabel="Edit"
        />
      </div>

      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Q&amp;A</h1>
            <p className={styles.workspaceEditorLead}>
              Questions and one answer per group. Update the fields below, then apply your changes.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit Q&amp;A</p>
        <form
          className="mt-4 w-full min-w-0 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            requestSave();
          }}
        >
          <FieldRow
            label="Title"
            htmlFor="qa-title"
            required
            helperText="Shown in your library and for this Q&A group."
            error={titleInvalid ? 'Title is required.' : undefined}
          >
            <Input
              id="qa-title"
              quiet
              className="w-full min-w-0"
              value={title}
              invalid={titleInvalid}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              placeholder="Shipping and returns"
            />
          </FieldRow>
          <FieldRow
            label="Questions"
            htmlFor="qa-q-0"
            required
            helperText="Add a row for each phrasing. Order is preserved."
            error={questionsInvalid ? 'Enter at least one question.' : undefined}
          >
            <div className="space-y-2">
              {questionInputs.map((q, qi) => (
                <div key={qi} className="flex gap-2">
                  <Input
                    id={qi === 0 ? 'qa-q-0' : undefined}
                    quiet
                    className="min-w-0 flex-1"
                    value={q}
                    invalid={questionsInvalid}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQuestionInputs((prev) => prev.map((line, i) => (i === qi ? v : line)));
                    }}
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
                variant="secondary"
                size="sm"
                className={styles.knowledgeFormActionSecondary}
                onClick={() => setQuestionInputs((prev) => [...prev, ''])}
              >
                <Plus size={16} strokeWidth={2} aria-hidden />
                Add question
              </Button>
            </div>
          </FieldRow>
          <FieldRow
            label="Answer"
            htmlFor="qa-answer"
            required
            helperText="Aim for one short paragraph."
            error={answerInvalid ? 'Answer is required.' : undefined}
          >
            <Textarea
              id="qa-answer"
              quiet
              rows={4}
              value={answer}
              invalid={answerInvalid}
              onChange={(e) => setAnswer(e.target.value)}
              className={cn(styles.workspaceEditorControlInput, 'min-h-[6.5rem] w-full resize-y py-2.5')}
            />
          </FieldRow>
          <div className={styles.knowledgeFormActionsRow}>
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
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving}
              className={styles.knowledgeFormActionPrimary}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </form>
      </div>

      <KnowledgeSaveConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={() => void confirmSave()}
        title="Update Q&A?"
        description="Your edits will be applied to this assistant’s knowledge base."
        confirmLabel="Update"
        busy={saving}
      />
    </div>
  );
}
