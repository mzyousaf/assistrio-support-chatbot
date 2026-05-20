import { Link } from 'react-router-dom';
import { ExternalLink, Globe, Lock } from 'lucide-react';
import type { AdminBotListItem } from '@/api/types';
import { PlatformBotBadges } from '@/components/PlatformBotBadges';
import { cn } from '@/lib/utils';

function relDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusBadge(status: string) {
  const v = (status || '').toLowerCase();
  if (v === 'published') {
    return { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  }
  if (v === 'draft') {
    return { label: 'Draft', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  }
  return { label: status || '—', dot: 'bg-gray-300', text: 'text-gray-600', bg: 'bg-gray-50' };
}

type Props = {
  bot: AdminBotListItem;
};

export function AdminBotCard({ bot }: Props) {
  const st = statusBadge(bot.status);
  const isPrivate = bot.visibility === 'private' || !bot.isPublic;
  const accent = bot.primaryColor && /^#[0-9a-f]{6}$/i.test(bot.primaryColor) ? bot.primaryColor : '#14b8a6';

  return (
    <article
      className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accent }} aria-hidden />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[0.9375rem] font-semibold leading-snug text-slate-900">
              {bot.name?.trim() || 'Untitled bot'}
            </h2>
            <PlatformBotBadges
              isPlatformBot={bot.isPlatformBot}
              platformBotType={bot.platformBotType}
              className="mt-1.5"
            />
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
              st.bg,
              st.text,
            )}
          >
            <span className={cn('size-1.5 rounded-full', st.dot)} aria-hidden />
            {st.label}
          </span>
        </div>

        {bot.shortDescription ? (
          <p className="mb-3 line-clamp-2 text-[0.8125rem] leading-relaxed text-slate-500">{bot.shortDescription}</p>
        ) : (
          <p className="mb-3 text-[0.8125rem] text-slate-400">No short description</p>
        )}

        <ul className="mb-4 flex flex-col gap-1.5 text-[0.75rem] text-slate-500">
          <li className="flex items-center gap-1.5">
            {isPrivate ? <Lock size={13} aria-hidden /> : <Globe size={13} aria-hidden />}
            <span>{isPrivate ? 'Private' : 'Public'}</span>
            {bot.slug ? <span className="text-slate-400">· /{bot.slug}</span> : null}
          </li>
          <li>
            <span className="text-slate-400">Created </span>
            {relDate(bot.createdAt)}
          </li>
          {bot.lastActivityAt ? (
            <li>
              <span className="text-slate-400">Last activity </span>
              {relDate(bot.lastActivityAt)}
            </li>
          ) : null}
          {bot.workspaceId ? (
            <li className="truncate font-mono text-[0.6875rem] text-slate-400" title={bot.workspaceId}>
              Workspace {bot.workspaceId.slice(-8)}
            </li>
          ) : null}
        </ul>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
          <Link
            to={`/bots/${bot._id}`}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[0.8125rem] font-semibold text-white no-underline transition-colors hover:bg-[var(--teal-800)]"
          >
            Open
            <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
