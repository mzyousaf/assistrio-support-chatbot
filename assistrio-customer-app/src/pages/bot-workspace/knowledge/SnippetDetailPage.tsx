import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { patchCustomerBot } from '../../../api/customerApi';
import { appToast } from '@/lib/app-toast';
import { useBotWorkspace } from '../BotWorkspaceContext';
import { KnowledgeDeleteConfirmModal } from './knowledgeSourcesListUi';
import {
  KnowledgeItemDetailPageShell,
  KnowledgeItemTrainingAnalytics,
  useKnowledgeDetailTab,
} from './knowledgeItemDetailShared';
import { snippetsFromBot } from './knowledgeViewTypes';

export function SnippetDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromBot = useMemo(() => snippetsFromBot(bot), [bot]);
  const row = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/snippets`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (loadState !== 'ok' || !bot) return;
    if (indexParam === 'new') return;
    if (!row) {
      void navigate(`${base}/snippets`, { replace: true });
    }
  }, [loadState, bot, row, indexParam, navigate, base]);

  async function confirmRemove() {
    if (!botId || !row || numIndex < 0) return;
    setDeleting(true);
    try {
      const next = fromBot
        .filter((_, i) => i !== numIndex)
        .map((s) => ({
          title: s.title.trim() || 'Snippet',
          snippet: s.snippet.trim(),
          active: s.active !== false,
        }))
        .filter((s) => s.snippet);
      const res = await patchCustomerBot(botId, { knowledgeSnippets: next });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Snippet removed');
      await softReload();
      void navigate(`${base}/snippets`, { replace: true });
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

  const title = (row.title || `Snippet ${numIndex + 1}`).trim() || `Snippet ${numIndex + 1}`;

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Snippets"
        onBack={() => void navigate(`${base}/snippets`)}
        sectionLabel="Snippets"
        itemTitle={title}
        onEdit={() => void navigate(`${base}/snippets/${numIndex}/edit`)}
        onDelete={() => setDeleteOpen(true)}
        deleteBusy={deleting}
        tab={tab}
        onTabChange={setTab}
        tabContent={
          <div className="space-y-4 rounded-xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div>
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Title</h2>
              <p className="mt-1.5 m-0 text-sm font-medium text-slate-900">{row.title || '—'}</p>
            </div>
            <div>
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h2>
              <p className="mt-1.5 m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                {row.snippet || '—'}
              </p>
            </div>
          </div>
        }
        analyticsContent={
          <KnowledgeItemTrainingAnalytics status={row.trainingStatus} lastTrainedAt={row.lastTrainedAt} />
        }
      />
      <KnowledgeDeleteConfirmModal
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => void confirmRemove()}
        title="Remove this snippet?"
        description="This snippet will be removed from the assistant’s knowledge base. This cannot be undone."
        busy={deleting}
      />
    </>
  );
}
