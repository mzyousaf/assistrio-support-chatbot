import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { appToast } from '@/lib/app-toast';
import { patchCustomerBot } from '../../../api/customerApi';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { Button, FieldRow, Input, Textarea } from '@/components/ui';
import { KnowledgeBackBreadcrumbRow, KnowledgeSaveConfirmModal } from './knowledgeSourcesListUi';
import { cn } from '@/lib/utils';
import { ws as styles } from '../workspace';
import type { SnippetRow } from './knowledgeViewTypes';
import { snippetsFromBot } from './knowledgeViewTypes';

export function SnippetEditPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);

  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/snippets`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (indexParam === 'new') return;
    if (loadState !== 'ok' || !bot) return;
    if (!Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length) {
      void navigate(`${base}/snippets`, { replace: true });
      return;
    }
    const s = fromBot[numIndex]!;
    setTitle(s.title);
    setBody(s.snippet);
  }, [indexParam, numIndex, fromBot, loadState, bot, navigate, base]);

  async function persistSnippets(next: SnippetRow[], successToast: string): Promise<boolean> {
    if (!botId) return false;
    setSaving(true);
    try {
      const res = await patchCustomerBot(botId, {
        knowledgeSnippets: next
          .map((s) => ({
            title: s.title.trim() || 'Snippet',
            snippet: s.snippet.trim(),
            active: s.active !== false,
          }))
          .filter((s) => s.snippet),
      });
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
    setSaveAttempted(true);
    const t = title.trim();
    const snippet = body.trim();
    if (!t || !snippet) return;
    setSaveConfirmOpen(true);
  }

  async function confirmSave() {
    if (!botId || indexParam === 'new') return;
    const t = title.trim();
    const snippet = body.trim();
    if (!t || !snippet) {
      setSaveConfirmOpen(false);
      setSaveAttempted(true);
      return;
    }
    if (numIndex < 0 || numIndex >= fromBot.length) {
      setSaveConfirmOpen(false);
      return;
    }
    const next = fromBot.map((s, i) => (i === numIndex ? { title: t, snippet, active: true } : s));
    const ok = await persistSnippets(next, 'Snippet updated');
    if (ok) {
      setSaveConfirmOpen(false);
      setSaveAttempted(false);
      void navigate(`${base}/snippets/${numIndex}`, { replace: true });
    }
  }

  if (!botId) return null;
  if (indexParam === 'new') return null;

  const titleInvalid = saveAttempted && !title.trim();
  const descInvalid = saveAttempted && !body.trim();

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-6 px-0"
      data-knowledge-snippet-editor
    >
      <div className="shrink-0">
        <KnowledgeBackBreadcrumbRow
          backLabel="Back"
          onBack={() => void navigate(`${base}/snippets/${numIndex}`)}
          sectionLabel="Snippets"
          lastCrumb={title.trim() || 'Snippet'}
          tailLabel="Edit"
        />
      </div>

      <header className={cn(styles.workspaceEditorPageHeader, 'shrink-0')}>
        <div className={styles.workspaceEditorTitleBlock}>
          <div className={styles.workspaceEditorHeadingStack}>
            <h1 className={styles.workspaceEditorH1}>Snippets</h1>
            <p className={styles.workspaceEditorLead}>
              Short notes the model can retrieve. Update the fields below, then apply your changes.
            </p>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'shrink-0 rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        )}
      >
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Edit snippet</p>
        <div className="mt-4 w-full min-w-0 space-y-5">
          <FieldRow
            label="Title"
            htmlFor="snippet-title"
            required
            helperText="Short label in your library."
            error={titleInvalid ? 'Title is required.' : undefined}
          >
            <Input
              id="snippet-title"
              quiet
              className="w-full min-w-0"
              value={title}
              invalid={titleInvalid}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              placeholder="e.g. Return policy"
            />
          </FieldRow>
          <FieldRow
            label="Description"
            htmlFor="snippet-body"
            required
            helperText="One or more paragraphs. Be concise and factual."
            error={descInvalid ? 'Description is required.' : undefined}
          >
            <Textarea
              id="snippet-body"
              quiet
              rows={4}
              value={body}
              invalid={descInvalid}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Factual text the model may quote or paraphrase."
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
              onClick={() => void navigate(`${base}/snippets/${numIndex}`)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={saving}
              onClick={() => void requestSave()}
              className={styles.knowledgeFormActionPrimary}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        </div>
      </div>

      <KnowledgeSaveConfirmModal
        open={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={() => void confirmSave()}
        title="Update snippet?"
        description="Your edits will be applied to this assistant’s knowledge base."
        confirmLabel="Update"
        busy={saving}
      />
    </div>
  );
}
