import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { patchCustomerBot } from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { KnowledgeDeleteConfirmModal } from './knowledgeSourcesListUi';
import { KnowledgeItemDetailPageShell, useKnowledgeDetailTab } from './knowledgeItemDetailShared';
import { exampleQuestionsToPatchPayload, hydrateExampleQuestionsFromBot } from '../exampleQuestionHelpers';

export function KnowledgeSuggestionDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromBot = useMemo(() => hydrateExampleQuestionsFromBot(bot), [bot]);
  const row = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (loadState !== 'ok' || !bot) return;
    if (indexParam === 'new') return;
    if (!row) {
      void navigate(`${base}/suggestions`, { replace: true });
    }
  }, [loadState, bot, row, indexParam, navigate, base]);

  async function confirmRemove() {
    if (!botId || !row || numIndex < 0) return;
    setDeleting(true);
    try {
      const next = fromBot.filter((_, i) => i !== numIndex);
      const res = await patchCustomerBot(botId, { exampleQuestions: exampleQuestionsToPatchPayload(next) });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Suggestion removed');
      await softReload();
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

  const title = (row.label || `Suggestion ${numIndex + 1}`).trim() || `Suggestion ${numIndex + 1}`;
  const hasScope = Boolean(row.context?.trim());

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Suggestions"
        onBack={() => void navigate(`${base}/suggestions`)}
        sectionLabel="Suggestions"
        itemTitle={title}
        onEdit={() => void navigate(`${base}/suggestions/${numIndex}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        tabContent={
          <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div>
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Chip text</h2>
              <p className="mt-1.5 m-0 text-sm font-medium text-slate-900">{row.label || '—'}</p>
            </div>
            <div>
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Scoped information</h2>
              {hasScope ? (
                <p className="mt-1.5 m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                  {row.context.trim()}
                </p>
              ) : (
                <p className="mt-1.5 m-0 text-sm text-slate-500">None — first reply after this chip uses the full knowledge base.</p>
              )}
            </div>
          </div>
        }
        analyticsContent={
          <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="m-0 text-sm font-semibold text-slate-900">Analytics</h2>
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              Suggestions are not stored as retrievable knowledge items, so there is no training or indexing status.
            </p>
          </div>
        }
      />
      <KnowledgeDeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => void confirmRemove()}
        title="Remove this suggestion?"
        description="This suggestion will be removed. This cannot be undone."
        busy={deleting}
      />
    </>
  );
}
