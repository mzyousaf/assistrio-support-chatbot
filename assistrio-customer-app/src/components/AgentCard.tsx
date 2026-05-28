import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code2, ExternalLink, FileText, Globe, GraduationCap, HelpCircle, Link2,
  Lock, MessagesSquare, MessageSquare, MoreHorizontal,
  StickyNote, Table2, Trash2, UserCheck,
} from 'lucide-react';
import type { CustomerBotListItem } from '../api/types';
import { AgentEmbedModal } from '@/components/AgentEmbedModal';
import { AgentViewAccessAvatarGroup } from '@/components/AgentViewAccessAvatarGroup';
import { Tooltip } from '@/components/ui';
import { CATEGORY_OPTIONS } from '@/pages/bot-workspace/behaviorConstants';
import { cn } from '@/lib/utils';

/* ── helpers ─────────────────────────────────────────────────────── */

function relDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isPriv(b: CustomerBotListItem) { return b.visibility === 'private' || !b.isPublic; }

function stInfo(s: string) {
  const v = (s || '').toLowerCase();
  if (v === 'published') return { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (v === 'draft') return { label: 'Draft', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' };
  return { label: s || '—', dot: 'bg-gray-300', text: 'text-gray-600', bg: 'bg-gray-50' };
}

function catTags(c: string | undefined): string[] {
  if (!c?.trim()) return [];
  return c.split(/[,/]+/).map((t) => t.trim()).filter(Boolean);
}

const CATEGORY_TAG_MAX_LEN = 18;

function formatCategoryLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const preset = CATEGORY_OPTIONS.find((c) => c.value === trimmed.toLowerCase());
  if (preset) return preset.label;
  return trimmed.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function botCategoryLabels(bot: CustomerBotListItem): string[] {
  const raw =
    bot.categories?.length
      ? bot.categories
      : catTags(bot.category).length
        ? catTags(bot.category)
        : bot.category?.trim()
          ? [bot.category.trim()]
          : [];
  const labels = raw.map(formatCategoryLabel).filter(Boolean);
  return [...new Set(labels)];
}

function StatusTag({ status }: { status: string }) {
  const st = stInfo(status);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold leading-none',
        st.bg,
        st.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />
      {st.label}
    </span>
  );
}

function CategoryTag({ label, accent }: { label: string; accent: string }) {
  const needsTooltip = label.length > CATEGORY_TAG_MAX_LEN;
  const tag = (
    <span
      className={cn(
        'inline-block max-w-[8.5rem] truncate rounded-md px-2 py-0.5 text-[0.6875rem] font-medium',
        needsTooltip && 'cursor-default',
      )}
      style={{ backgroundColor: accent + '14', color: accent }}
    >
      {label}
    </span>
  );
  if (!needsTooltip) return tag;
  return <Tooltip content={label}>{tag}</Tooltip>;
}

function domain(o: string[] | undefined) {
  if (!o?.length) return null;
  try { return new URL(o[0]).hostname; } catch { return o[0]; }
}

function accentHex(c: string | undefined): string {
  if (c && /^#[0-9a-f]{6}$/i.test(c)) return c;
  return '#0d9488';
}

function compactNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.floor(n / 1000) + 'k';
}

/* ── embed button ────────────────────────────────────────────────── */

function EmbedButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Embed agent"
      aria-label="Embed agent"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
    >
      <Code2 size={12} strokeWidth={2} />
      Embed
    </button>
  );
}

function Avatar({ bot, accent }: { bot: CustomerBotListItem; accent: string }) {
  const cls = 'h-10 w-10 rounded-xl';
  if (bot.imageUrl) return <img src={bot.imageUrl} alt="" className={cn(cls, 'object-cover')} />;
  if (bot.avatarEmoji?.trim())
    return (
      <div
        className={cn(cls, 'assistrio-emoji-presentation flex items-center justify-center text-lg leading-none')}
        style={{ backgroundColor: accent + '18' }}
      >
        {bot.avatarEmoji.trim()}
      </div>
    );
  return <div className={cn(cls, 'flex items-center justify-center')} style={{ backgroundColor: accent }}><MessageSquare size={18} strokeWidth={2} className="text-white" /></div>;
}

/* ── stat pill ───────────────────────────────────────────────────── */

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] text-gray-500" title={label}>
      <span className="text-gray-400">{icon}</span>
      {value}
    </span>
  );
}

/* ── avatar ──────────────────────────────────────────────────────── */

function CardMenu({ href, onDelete, canDelete = true }: { href: string; onDelete: () => void; canDelete?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <span className="relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
      >
        <MoreHorizontal size={15} strokeWidth={2} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={close} />
          <div className="absolute right-0 top-8 z-30 w-40 rounded-xl bg-white py-1 shadow-[var(--shadow-dropdown)]" style={{ border: '1px solid var(--border-soft)' }}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] text-gray-700 no-underline transition-colors hover:bg-gray-50"
            >
              <ExternalLink size={13} strokeWidth={2} /> Open in new tab
            </a>
            {canDelete ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); close(); onDelete(); }}
              className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3 py-1.5 text-left text-[0.8125rem] text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 size={13} strokeWidth={2} /> Delete
            </button>
            ) : null}
          </div>
        </>
      )}
    </span>
  );
}

/* ── delete dialog ───────────────────────────────────────────────── */

export function DeleteAgentDialog({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" style={{ border: '1px solid var(--border-soft)' }}>
        <h3 className="m-0 text-base font-semibold text-gray-900">Delete agent</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Are you sure you want to delete <strong className="text-gray-700">{name || 'this agent'}</strong>?
          This permanently removes the agent, its conversations, and all knowledge data.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button type="button" onClick={onCancel} className="cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-2 text-[0.8125rem] font-medium text-gray-600 shadow-sm transition hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={onConfirm} className="cursor-pointer rounded-lg border-none bg-red-600 px-4 py-2 text-[0.8125rem] font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98]">Delete permanently</button>
        </div>
      </div>
    </div>
  );
}

/* ── agent card ──────────────────────────────────────────────────── */

export type AgentCardProps = {
  bot: CustomerBotListItem;
  deleting?: boolean;
  onDelete: (b: CustomerBotListItem) => void;
  canDelete?: boolean;
  onShare?: (b: CustomerBotListItem) => void;
  /** When true, renders the view-access avatar stack (owners/admins, or dev preview). */
  showViewAccessPreview?: boolean;
};

export function AgentCard({
  bot,
  deleting,
  onDelete,
  canDelete = true,
  onShare,
  showViewAccessPreview,
}: AgentCardProps) {
  const [embedOpen, setEmbedOpen] = useState(false);
  const p = isPriv(bot);
  const categoryLabels = botCategoryLabels(bot);
  const dom = domain(bot.activeOrigins);
  const accent = accentHex(bot.primaryColor);
  const activity = relDate(bot.lastActivityAt);
  const trained = relDate(bot.lastTrainedAt);
  const href = `/bots/${bot._id}`;
  const showViewAccessStack = showViewAccessPreview ?? Boolean(onShare);

  const conversations = bot.totalConversations ?? 0;
  const messages = bot.totalMessages ?? 0;
  const docs = bot.knowledgeDocs ?? 0;
  const faqs = bot.knowledgeFaqs ?? 0;
  const snippets = bot.knowledgeSnippets ?? 0;
  const datasheets = bot.knowledgeDatasheets ?? 0;
  const knowledgeTotal = docs + faqs + snippets + datasheets;

  return (
    <>
    <article
      className={cn('group/card relative flex h-full flex-col rounded-2xl bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-[var(--shadow-card-hover)]', deleting && 'pointer-events-none opacity-40')}
      style={{ border: '1px solid var(--border-soft)' }}
    >

      {/* ─── Header ─── */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-0">
        <Link to={href} className="shrink-0 no-underline"><Avatar bot={bot} accent={accent} /></Link>

        <div className="min-w-0 flex-1">
          <Link to={href} className="no-underline text-inherit">
            <h3 className="m-0 truncate text-sm font-semibold text-gray-900">{bot.name?.trim() || 'Untitled agent'}</h3>
          </Link>
          <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-gray-500">
            <span className="inline-flex items-center gap-1">
              {p ? <Lock size={11} strokeWidth={2.5} className="text-gray-500" /> : <Globe size={11} strokeWidth={2.5} className="text-gray-500" />}
              {p ? 'Private' : 'Public'}
            </span>
            {dom && (
              <>
                <span className="text-gray-300">&middot;</span>
                <span className="inline-flex items-center gap-1 truncate">
                  <Link2 size={11} strokeWidth={2.5} className="shrink-0 text-gray-500" />
                  <span className="truncate">{dom}</span>
                </span>
              </>
            )}
          </div>
        </div>

        <CardMenu href={href} onDelete={() => onDelete(bot)} canDelete={canDelete} />
      </div>

      {/* ─── Status + category tags ─── */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2.5">
        <StatusTag status={bot.status} />
        {categoryLabels.map((label) => (
          <CategoryTag key={label} label={label} accent={accent} />
        ))}
      </div>

      {/* ─── Stats + activity ─── */}
      <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
      <Link to={href} className="block no-underline text-inherit">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Stat
            icon={<MessagesSquare size={12} strokeWidth={2} />}
            value={compactNum(conversations)}
            label={`${conversations} conversation${conversations !== 1 ? 's' : ''}`}
          />
          <Stat
            icon={<MessageSquare size={12} strokeWidth={2} />}
            value={compactNum(messages)}
            label={`${messages} message${messages !== 1 ? 's' : ''}`}
          />

          {knowledgeTotal > 0 && (
            <span className="inline-flex items-center gap-2 text-[0.6875rem] text-gray-500">
              <span className="text-gray-300">|</span>
              {docs > 0 && (
                <span className="inline-flex items-center gap-1" title={`${docs} document${docs !== 1 ? 's' : ''}`}>
                  <FileText size={11} strokeWidth={2} className="text-gray-400" />
                  {docs}
                </span>
              )}
              {faqs > 0 && (
                <span className="inline-flex items-center gap-1" title={`${faqs} FAQ${faqs !== 1 ? 's' : ''}`}>
                  <HelpCircle size={11} strokeWidth={2} className="text-gray-400" />
                  {faqs}
                </span>
              )}
              {snippets > 0 && (
                <span className="inline-flex items-center gap-1" title={`${snippets} snippet${snippets !== 1 ? 's' : ''}`}>
                  <StickyNote size={11} strokeWidth={2} className="text-gray-400" />
                  {snippets}
                </span>
              )}
              {datasheets > 0 && (
                <span
                  className="inline-flex items-center gap-1"
                  title={`${datasheets} datasheet${datasheets !== 1 ? 's' : ''}`}
                >
                  <Table2 size={11} strokeWidth={2} className="text-gray-400" />
                  {datasheets}
                </span>
              )}
            </span>
          )}
        </div>
      </Link>

        {/* activity + lead capture + view access */}
        {(activity || bot.leadCaptureEnabled || showViewAccessStack) && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <Link to={href} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-gray-400 no-underline">
              {activity && (
                <span className="inline-flex items-center gap-1 text-inherit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active {activity}
                </span>
              )}

              {bot.leadCaptureEnabled && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <UserCheck size={11} strokeWidth={2} />
                  Lead capture
                </span>
              )}
            </Link>

            {showViewAccessStack ? (
              <AgentViewAccessAvatarGroup
                members={bot.viewAccessPreview ?? []}
                onAdd={() => onShare?.(bot)}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <div className="flex items-center px-4 py-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <div className="min-w-0 flex-1 text-[0.6875rem] text-gray-400">
          {trained && (
            <span className="inline-flex items-center gap-1">
              <GraduationCap size={11} strokeWidth={2} className="text-gray-400" />
              Trained {trained}
            </span>
          )}
        </div>
        <EmbedButton onClick={() => setEmbedOpen(true)} />
      </div>
    </article>
    <AgentEmbedModal open={embedOpen} bot={bot} onClose={() => setEmbedOpen(false)} />
    </>
  );
}
