import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  User,
  Brain,
  BookOpen,
  Cpu,
  MessageCircle,
  Palette,
  Rocket,
  MessageSquare,
  UserCheck,
  BarChart3,
  StickyNote,
  HelpCircle,
  FileText,
  MessagesSquare,
  Tags,
  SmilePlus,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCustomerBot } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { cn } from '@/lib/utils';

type Props = { bot?: CustomerBotDetail | null; health?: Record<string, unknown> | null };

function healthNum(h: Record<string, unknown> | null | undefined, key: string): number {
  const v = h?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function healthIsoString(h: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = h?.[key];
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? v : null;
}

/** Compact size for ready document bytes (e.g. `3 KB`). */
function formatIndexedKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${Math.max(1, Math.round(bytes))} B`;
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}

/** Relative time for last trained (includes months for long gaps). */
function relTrainedAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

function TrainingStatusCard({
  health,
  botId,
}: {
  health: Record<string, unknown> | null;
  botId: string | undefined;
}) {
  const [live, setLive] = useState<Record<string, unknown> | null>(health);

  useEffect(() => {
    setLive(health);
  }, [health]);

  const queued = healthNum(live, 'docsQueued');
  const processing = healthNum(live, 'docsProcessing');
  const indexedBytes = healthNum(live, 'docsIndexedBytes');
  const isTraining = queued + processing > 0;
  const lastIngested = healthIsoString(live, 'lastIngestedAt');
  const ago = relTrainedAgo(lastIngested);

  useEffect(() => {
    if (!botId || !isTraining) return;
    const t = window.setInterval(() => {
      void (async () => {
        const res = await getCustomerBot(botId);
        if (res.ok) setLive(res.data.health ?? null);
      })();
    }, 4000);
    return () => window.clearInterval(t);
  }, [botId, isTraining]);

  const subline = (() => {
    if (!live) return 'Loading…';
    const sizePart = formatIndexedKb(indexedBytes);
    if (ago) {
      const base = `Last trained ${ago}`;
      return sizePart ? `${base} • ${sizePart}` : base;
    }
    if (isTraining) return sizePart ? `Indexing documents… • ${sizePart}` : 'Indexing documents…';
    return 'No indexed documents yet';
  })();

  const statusTeal = 'text-teal-800';
  const dotTeal = 'bg-teal-700';

  return (
    <div
      className="mb-3 w-full max-[900px]:max-w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2.5 shadow-[var(--shadow-xs)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              dotTeal,
              isTraining && live && 'animate-pulse',
            )}
            aria-hidden
          />
          <span className={cn('text-sm font-semibold', statusTeal)}>
            {!live ? 'Training status' : isTraining ? 'Training' : 'Trained'}
          </span>
        </div>
        <p className="text-[0.75rem] font-normal leading-snug text-slate-500">{subline}</p>
      </div>
    </div>
  );
}

const navCls = (isActive: boolean) =>
  cn(
    'group flex items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium no-underline leading-[1.3] transition-[background-color,color] duration-150',
    isActive ? 'nav-active font-semibold' : 'text-slate-500 nav-hover',
  );

const subCls = (isActive: boolean) =>
  cn(
    'group flex items-center gap-2 rounded-md py-[0.375rem] pl-2.5 pr-2 text-[0.8125rem] font-medium no-underline leading-[1.3] transition-[background-color,color] duration-150',
    isActive ? 'nav-active font-semibold' : 'text-slate-400 nav-hover',
  );

const parentBtnCls = (isActive: boolean) =>
  cn(
    'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium cursor-pointer border-none bg-transparent text-left',
    'transition-[background-color,color] duration-150',
    isActive ? 'font-semibold text-[var(--active-text)]' : 'text-slate-500 nav-hover',
  );

const iconCls = (isActive: boolean) =>
  cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600');

const subIconCls = (isActive: boolean) =>
  cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600');

export function AgentWorkspaceSidebar({ bot: _bot, health }: Props) {
  const { id: routeBotId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const base = routeBotId ? `/bots/${routeBotId}` : '';

  const match = (suffix: string) => Boolean(base) && pathname.startsWith(`${base}/${suffix}`);

  const isKnowledgeNotes = match('knowledge/notes') || match('knowledge/text');
  const isKnowledgeFaqs = match('knowledge/faqs') || match('knowledge/qa');
  const isKnowledgeDocs = match('knowledge/documents') || match('knowledge/files') || pathname === `${base}/knowledge`;
  const isKnowledgeParent = isKnowledgeNotes || isKnowledgeFaqs || isKnowledgeDocs;

  const isAnalyticsChats = match('analytics/chats');
  const isAnalyticsTopics = match('analytics/topics');
  const isAnalyticsSentiment = match('analytics/sentiment');
  const isAnalyticsParent = isAnalyticsChats || isAnalyticsTopics || isAnalyticsSentiment;

  const [kbOpen, setKbOpen] = useState(isKnowledgeParent);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsParent);

  const kbSubNav = [
    { to: `${base}/knowledge/notes`, label: 'Notes', Icon: StickyNote, active: isKnowledgeNotes },
    { to: `${base}/knowledge/faqs`, label: 'FAQs', Icon: HelpCircle, active: isKnowledgeFaqs },
    { to: `${base}/knowledge/documents`, label: 'Documents', Icon: FileText, active: isKnowledgeDocs },
  ];

  const analyticsSubNav = [
    { to: `${base}/analytics/chats`, label: 'Chats', Icon: MessagesSquare, active: isAnalyticsChats },
    { to: `${base}/analytics/topics`, label: 'Topics', Icon: Tags, active: isAnalyticsTopics },
    { to: `${base}/analytics/sentiment`, label: 'Sentiment', Icon: SmilePlus, active: isAnalyticsSentiment },
  ];

  // Track bar refs & indicators for Knowledge Base
  const kbTrackRef = useRef<HTMLDivElement>(null);
  const kbSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [kbIndicator, setKbIndicator] = useState<{ top: number; height: number } | null>(null);

  // Track bar refs & indicators for Analytics
  const analyticsTrackRef = useRef<HTMLDivElement>(null);
  const analyticsSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [analyticsIndicator, setAnalyticsIndicator] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    // KB indicator
    const kbActiveIdx = kbSubNav.findIndex((item) => item.active);
    const kbEl = kbSubNavRefs.current[kbActiveIdx];
    const kbTrack = kbTrackRef.current;
    if (kbEl && kbTrack) {
      const trackRect = kbTrack.getBoundingClientRect();
      const elRect = kbEl.getBoundingClientRect();
      setKbIndicator({ top: elRect.top - trackRect.top + 2, height: elRect.height - 4 });
    } else {
      setKbIndicator(null);
    }

    // Analytics indicator
    const aActiveIdx = analyticsSubNav.findIndex((item) => item.active);
    const aEl = analyticsSubNavRefs.current[aActiveIdx];
    const aTrack = analyticsTrackRef.current;
    if (aEl && aTrack) {
      const trackRect = aTrack.getBoundingClientRect();
      const elRect = aEl.getBoundingClientRect();
      setAnalyticsIndicator({ top: elRect.top - trackRect.top + 2, height: elRect.height - 4 });
    } else {
      setAnalyticsIndicator(null);
    }
  }, [pathname, kbOpen, analyticsOpen]);

  return (
    <aside
      className="flex w-[var(--sidebar-width)] shrink-0 flex-col overflow-y-auto p-3 max-[900px]:w-full max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:p-2"
      style={{ background: 'var(--bg-sidebar-secondary)', borderRight: '1px solid var(--border-soft)' }}
      aria-label="Agent workspace"
    >
      <nav
        className="flex flex-1 flex-col overflow-y-auto max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-[0.35rem]"
        aria-label="Workspace sections"
      >
        {routeBotId ? <TrainingStatusCard health={health ?? null} botId={routeBotId} /> : null}

        {/* ── Playground ── */}
        <p className="mb-2.5 ml-2.5 mt-2 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
          Playground
        </p>

        <div className="flex flex-col gap-1">
          <NavLink to={`${base}/playground/profile`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><User size={18} strokeWidth={1.75} className={iconCls(isActive)} />Profile</>}
          </NavLink>
          <NavLink to={`${base}/playground/behavior`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Brain size={18} strokeWidth={1.75} className={iconCls(isActive)} />Behavior</>}
          </NavLink>

          {/* Knowledge Base */}
          <button type="button" className={parentBtnCls(isKnowledgeParent)} onClick={() => {
            const opening = !kbOpen;
            setKbOpen(opening);
            if (opening && !isKnowledgeParent) navigate(`${base}/knowledge/notes`);
          }}>
            <BookOpen size={18} strokeWidth={1.75} className={iconCls(isKnowledgeParent)} />
            <span className="flex-1">Knowledge Base</span>
            <ChevronDown size={14} strokeWidth={1.8} className={cn('shrink-0 text-slate-300 transition-transform duration-200', kbOpen && 'rotate-180')} aria-hidden />
          </button>
          {kbOpen && (
            <div ref={kbTrackRef} className="relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3">
              <div className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full" style={{ background: 'var(--border-soft)' }} aria-hidden />
              {kbIndicator && (
                <div
                  className="absolute left-0 w-[2px] rounded-full bg-teal-500"
                  style={{
                    top: kbIndicator.top,
                    height: kbIndicator.height,
                    transition: 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  aria-hidden
                />
              )}
              {kbSubNav.map((item, i) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={() => subCls(item.active)}
                  ref={(el) => { kbSubNavRefs.current[i] = el; }}
                >
                  <item.Icon size={15} strokeWidth={1.75} className={subIconCls(item.active)} aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          <NavLink to={`${base}/playground/ai`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Cpu size={18} strokeWidth={1.75} className={iconCls(isActive)} />AI & Integrations</>}
          </NavLink>
          <NavLink to={`${base}/playground/chat`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><MessageCircle size={18} strokeWidth={1.75} className={iconCls(isActive)} />Chat</>}
          </NavLink>
          <NavLink to={`${base}/playground/appearance`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Palette size={18} strokeWidth={1.75} className={iconCls(isActive)} />Appearance</>}
          </NavLink>
          <NavLink to={`${base}/playground/publish`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Rocket size={18} strokeWidth={1.75} className={iconCls(isActive)} />Publish</>}
          </NavLink>
        </div>

        {/* ── Separator ── */}
        <div className="mx-2.5 my-3" style={{ borderTop: '1px solid var(--border-soft)' }} />

        {/* ── Insights ── */}
        <p className="mb-2.5 ml-2.5 mt-1 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
          Insights
        </p>

        <div className="flex flex-col gap-1">
          <NavLink to={`${base}/activity/chat-logs`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><MessageSquare size={18} strokeWidth={1.75} className={iconCls(isActive)} />Conversations</>}
          </NavLink>
          <NavLink to={`${base}/activity/leads`} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><UserCheck size={18} strokeWidth={1.75} className={iconCls(isActive)} />Leads</>}
          </NavLink>

          {/* Analytics */}
          <button type="button" className={parentBtnCls(isAnalyticsParent)} onClick={() => {
            const opening = !analyticsOpen;
            setAnalyticsOpen(opening);
            if (opening && !isAnalyticsParent) navigate(`${base}/analytics/chats`);
          }}>
            <BarChart3 size={18} strokeWidth={1.75} className={iconCls(isAnalyticsParent)} />
            <span className="flex-1">Analytics</span>
            <ChevronDown size={14} strokeWidth={1.8} className={cn('shrink-0 text-slate-300 transition-transform duration-200', analyticsOpen && 'rotate-180')} aria-hidden />
          </button>
          {analyticsOpen && (
            <div ref={analyticsTrackRef} className="relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3">
              <div className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full" style={{ background: 'var(--border-soft)' }} aria-hidden />
              {analyticsIndicator && (
                <div
                  className="absolute left-0 w-[2px] rounded-full bg-teal-500"
                  style={{
                    top: analyticsIndicator.top,
                    height: analyticsIndicator.height,
                    transition: 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
                  }}
                  aria-hidden
                />
              )}
              {analyticsSubNav.map((item, i) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={() => subCls(item.active)}
                  ref={(el) => { analyticsSubNavRefs.current[i] = el; }}
                >
                  <item.Icon size={15} strokeWidth={1.75} className={subIconCls(item.active)} aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
