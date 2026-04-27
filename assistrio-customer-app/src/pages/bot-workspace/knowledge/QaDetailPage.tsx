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
import { faqsFromBot, faqsToPatchPayload } from './knowledgeViewTypes';

export function QaDetailPage() {
  const { id: botId, index: indexParam } = useParams<{ id: string; index: string }>();
  const navigate = useNavigate();
  const { bot, loadState, softReload } = useBotWorkspace();
  const base = botId ? `/bots/${botId}/playground/knowledgebase` : '';
  const numIndex = Number.parseInt(String(indexParam), 10);
  const [tab, setTab] = useKnowledgeDetailTab();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fromBot = useMemo(() => (bot ? faqsFromBot(bot) : []), [bot]);
  const row = !Number.isFinite(numIndex) || numIndex < 0 || numIndex >= fromBot.length ? null : fromBot[numIndex]!;

  useEffect(() => {
    if (indexParam === 'new') {
      void navigate(`${base}/faqs`, { replace: true });
    }
  }, [indexParam, navigate, base]);

  useEffect(() => {
    if (loadState !== 'ok' || !bot) return;
    if (indexParam === 'new') return;
    if (!row) {
      void navigate(`${base}/faqs`, { replace: true });
    }
  }, [loadState, bot, row, indexParam, navigate, base]);

  async function confirmRemove() {
    if (!botId || !row || numIndex < 0) return;
    setDeleting(true);
    try {
      const nextFaqs = fromBot.filter((_, i) => i !== numIndex);
      const res = await patchCustomerBot(botId, { faqs: faqsToPatchPayload(nextFaqs) });
      if (!res.ok) {
        appToast.error('Could not remove', { description: res.error });
        return;
      }
      setDeleteOpen(false);
      appToast.success('Q&A removed');
      await softReload();
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

  const title =
    (row.title || row.questions[0] || `Q&A ${numIndex + 1}`).trim() || `Q&A ${numIndex + 1}`;

  return (
    <>
      <KnowledgeItemDetailPageShell
        backLabel="Back to Q&A"
        onBack={() => void navigate(`${base}/faqs`)}
        sectionLabel="Q&A"
        itemTitle={title}
        onEdit={() => void navigate(`${base}/faqs/${numIndex}/edit`)}
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
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Questions</h2>
              <ul className="mt-1.5 m-0 list-disc space-y-1 pl-5 text-sm text-slate-800">
                {row.questions.length ? (
                  row.questions.map((q, qi) => (
                    <li key={qi} className="[overflow-wrap:anywhere]">
                      {q}
                    </li>
                  ))
                ) : (
                  <li className="list-none pl-0 text-slate-400">—</li>
                )}
              </ul>
            </div>
            <div>
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</h2>
              <p className="mt-1.5 m-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                {row.answer || '—'}
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
        title="Remove this Q&A?"
        description="This entry will be removed from the assistant’s knowledge base. This cannot be undone."
        busy={deleting}
      />
    </>
  );
}
