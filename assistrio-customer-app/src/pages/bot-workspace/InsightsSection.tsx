import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomerBotInsights } from '../../api/customerApi';
import type { CustomerBotInsightsResponse } from '../../api/types';
import { useBotWorkspace } from './BotWorkspaceContext';
import { ws } from './workspace';
import { cn } from '@/lib/utils';
import { InlineLoader } from '../../components/PageLoader';
import { DataPageLayout, PageIntroStrip, WorkspaceContentContainer } from '@/layout/workspace-layout';

function formatInt(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function InsightsSection() {
  const { botId } = useBotWorkspace();
  const [data, setData] = useState<CustomerBotInsightsResponse | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!botId) return;
    let cancelled = false;
    setLoadState('loading');
    setMessage('');
    void (async () => {
      const res = await getCustomerBotInsights(botId);
      if (cancelled) return;
      if (!res.ok) { setData(null); setLoadState('error'); setMessage(res.error); return; }
      setData(res.data);
      setLoadState('ok');
    })();
    return () => { cancelled = true; };
  }, [botId]);

  if (!botId) return null;

  if (loadState === 'loading') {
    return (
      <WorkspaceContentContainer size="wide">
        <PageIntroStrip
          title="Insights"
          description="Conversations, messages, and knowledge snapshot for this assistant."
        />
        <InlineLoader title="Loading activity…" />
      </WorkspaceContentContainer>
    );
  }

  if (loadState === 'error' || !data) {
    return (
      <WorkspaceContentContainer size="wide">
        <PageIntroStrip
          title="Insights"
          description="Conversations, messages, and knowledge snapshot for this assistant."
        />
        <div className={ws.errorBox}>{message || 'Could not load insights.'}</div>
      </WorkspaceContentContainer>
    );
  }

  const { metrics, activity, bot } = data;
  const hasAnyActivity =
    metrics.totalConversations > 0 ||
    metrics.totalMessages > 0 ||
    metrics.conversationsWithCapturedLeads > 0;

  return (
    <DataPageLayout
      title="Insights"
      description="All-time totals from real chats (embed and hosted) and knowledge on this assistant."
      containerSize="wide"
    >
      <span
        className={cn(
          'mb-5 inline-block rounded-full px-[0.55rem] py-[0.2rem] text-[0.75rem] font-semibold',
          bot.status === 'published'
            ? 'bg-[var(--color-success-fill)] text-[var(--color-success-text)]'
            : 'bg-slate-100 text-slate-600',
        )}
      >
        {bot.status === 'published' ? 'Published' : 'Draft'}
      </span>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-4">
        {[
          { label: 'Chats started', value: formatInt(metrics.totalConversations), hint: 'Distinct conversation threads' },
          { label: 'Messages', value: formatInt(metrics.totalMessages), hint: 'All roles, all channels' },
          { label: 'Leads captured', value: formatInt(metrics.conversationsWithCapturedLeads), hint: 'Conversations with lead info saved' },
          { label: 'Knowledge documents', value: formatInt(metrics.knowledgeDocuments), hint: 'Files & sources in the base' },
          { label: 'Last activity', value: formatWhen(activity.lastActivityAt), hint: 'Latest message or chat update', smallValue: true },
        ].map((card) => (
          <div key={card.label} className="rounded-[0.625rem] border border-slate-100 bg-white p-[1rem_1rem_0.95rem]">
            <p className="mb-[0.35rem] mt-0 text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-slate-400">
              {card.label}
            </p>
            <p className={cn('m-0 font-semibold tracking-tight text-slate-900', card.smallValue ? 'text-base' : 'text-[1.375rem]')}>
              {card.value}
            </p>
            <p className="mt-[0.35rem] text-[0.75rem] leading-[1.35] text-slate-300">{card.hint}</p>
          </div>
        ))}
      </div>

      {!hasAnyActivity && (
        <div className="mt-6 rounded-[0.625rem] border border-dashed border-slate-200 bg-slate-50 p-[1.35rem_1.25rem]">
          <p className="mb-2 mt-0 text-base font-semibold text-slate-900">No visitor activity yet</p>
          <p className="mb-3 text-[0.9375rem] leading-[1.5] text-slate-600">
            When people chat with your assistant on your site or in the wild, counts will show up
            here. Add knowledge and publish when you're ready so visitors get great answers.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              [`/bots/${botId}/knowledge/documents`, 'Knowledge'],
              [`/bots/${botId}/playground/publish`, 'Publish'],
              [`/bots/${botId}/playground/chat`, 'Playground'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="text-[0.875rem] font-semibold text-primary no-underline hover:text-[var(--teal-800)] hover:underline">
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </DataPageLayout>
  );
}
