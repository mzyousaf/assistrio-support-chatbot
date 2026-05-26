import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  ChevronDown,
  User,
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
  Table2,
  FileText,
  ClipboardList,
  Sparkles,
  Lightbulb,
  LayoutDashboard,
  Globe2,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { CustomerBotDetail } from '../../api/types';
import { cn } from '@/lib/utils';
import {
  hasManualSaveDirty,
  hasManualSaveDirtyExcluding,
  hasManualSaveGuardDirty,
} from './workspaceManualSaveGuard';
import { useWorkspaceDiscardModal } from './WorkspaceDiscardModal';
import { TrainingStatusSidebarCard } from './components/TrainingStatusSidebarCard';

type Props = { bot?: CustomerBotDetail | null; health?: Record<string, unknown> | null };

const navCls = (isActive: boolean) =>
  cn(
    'group flex items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium no-underline leading-[1.3] transition-[background-color,color] duration-150',
    isActive ? 'nav-active font-semibold' : 'text-slate-500 nav-hover',
  );

const subCls = (isActive: boolean) =>
  cn(
    'group flex items-center gap-2 rounded-md py-[0.375rem] pl-2.5 pr-2 text-sm font-medium no-underline leading-[1.3] transition-[background-color,color] duration-150',
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

export function AgentWorkspaceSidebar({ bot, health }: Props) {
  const { id: routeBotId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const base = routeBotId ? `/bots/${routeBotId}` : '';

  const { requestDiscardIfNeeded, requestDiscardKnowledgeNotesIfNeeded } = useWorkspaceDiscardModal();

  const guardNav = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (!hasManualSaveDirty()) return;
      e.preventDefault();
      const href = e.currentTarget.getAttribute('href');
      if (!href) return;
      void (async () => {
        if (await requestDiscardIfNeeded()) navigate(href);
      })();
    },
    [navigate, requestDiscardIfNeeded],
  );

  /** Knowledge sub-routes: full discard if other sections are dirty; notes-only discard if only notes are dirty. */
  const kbKnowledgeSubNavClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, to: string) => {
      if (!hasManualSaveDirty()) return;
      e.preventDefault();
      void (async () => {
        const notesDirty = hasManualSaveGuardDirty('knowledge-notes');
        const otherDirty = hasManualSaveDirtyExcluding('knowledge-notes');
        let ok = true;
        if (otherDirty) {
          ok = await requestDiscardIfNeeded();
        } else if (notesDirty) {
          ok = await requestDiscardKnowledgeNotesIfNeeded();
        }
        if (ok) navigate(to);
      })();
    },
    [navigate, requestDiscardIfNeeded, requestDiscardKnowledgeNotesIfNeeded],
  );

  const match = (suffix: string) => Boolean(base) && pathname.startsWith(`${base}/${suffix}`);

  const isKnowledgeSnippets =
    match('playground/knowledgebase/snippets') ||
    match('playground/knowledgebase/notes') ||
    match('knowledge/snippets') ||
    match('knowledge/notes') ||
    match('knowledge/text');
  const isKnowledgeFaqs =
    match('playground/knowledgebase/faqs') || match('knowledge/faqs') || match('knowledge/qa');
  const isKnowledgeDatasheets =
    match('playground/knowledgebase/datasheets') ||
    match('playground/knowledgebase/tables') ||
    match('knowledge/datasheets') ||
    match('knowledge/tables');
  const isKnowledgeOverview =
    match('playground/knowledgebase/overview') ||
    match('knowledge/overview') ||
    pathname === `${base}/playground/knowledgebase`;
  const isKnowledgeDocs =
    match('playground/knowledgebase/documents') ||
    match('knowledge/documents') ||
    match('knowledge/files') ||
    pathname === `${base}/knowledge`;
  const isKnowledgeSuggestions = match('playground/knowledgebase/suggestions') || match('knowledge/suggestions');
  const isKnowledgeParent =
    isKnowledgeOverview ||
    isKnowledgeSnippets ||
    isKnowledgeFaqs ||
    isKnowledgeDatasheets ||
    isKnowledgeDocs ||
    isKnowledgeSuggestions;

  const isAnalyticsChats = match('analytics/chats');
  const isAnalyticsLeads = match('analytics/leads');
  const isAnalyticsTopics = match('analytics/topics');
  const isAnalyticsSentiment = match('analytics/sentiment');
  const isAnalyticsAgentResources = match('analytics/agent-resources');
  const isAnalyticsParent =
    isAnalyticsChats ||
    isAnalyticsAgentResources ||
    isAnalyticsLeads ||
    isAnalyticsTopics ||
    isAnalyticsSentiment;

  const [kbOpen, setKbOpen] = useState(isKnowledgeParent);
  const [analyticsOpen, setAnalyticsOpen] = useState(isAnalyticsParent);

  const kbSubNav = [
    {
      to: `${base}/playground/knowledgebase/overview`,
      label: 'Overview',
      Icon: LayoutDashboard,
      active: isKnowledgeOverview,
    },
    { to: `${base}/playground/knowledgebase/documents`, label: 'Documents', Icon: FileText, active: isKnowledgeDocs },
    { to: `${base}/playground/knowledgebase/faqs`, label: 'Q&A', Icon: HelpCircle, active: isKnowledgeFaqs },
    { to: `${base}/playground/knowledgebase/snippets`, label: 'Snippets', Icon: StickyNote, active: isKnowledgeSnippets },
    {
      to: `${base}/playground/knowledgebase/datasheets`,
      label: 'Datasheets',
      Icon: Table2,
      active: isKnowledgeDatasheets,
    },
    {
      to: `${base}/playground/knowledgebase/suggestions`,
      label: 'Suggestions',
      Icon: Lightbulb,
      active: isKnowledgeSuggestions,
    },
  ];

  const analyticsSubNav = [
    { to: `${base}/analytics/chats`, label: 'Chats', active: isAnalyticsChats },
    { to: `${base}/analytics/leads`, label: 'Leads', active: isAnalyticsLeads },
    { to: `${base}/analytics/topics`, label: 'Topics', active: isAnalyticsTopics },
    { to: `${base}/analytics/sentiment`, label: 'Sentiment', active: isAnalyticsSentiment },
    { to: `${base}/analytics/agent-resources`, label: 'Agent Resources', active: isAnalyticsAgentResources },
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
      className={cn(
        'scrollbar-none flex w-[var(--sidebar-width)] shrink-0 flex-col self-stretch',
        'min-h-0 overflow-y-auto overflow-x-hidden',
        'p-3 max-[900px]:max-h-[min(42vh,22rem)] max-[900px]:w-full max-[900px]:self-start max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:p-2',
      )}
      style={{ background: 'var(--bg-sidebar-secondary)' }}
      aria-label="Agent workspace"
    >
      <nav
        className="flex flex-col max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:gap-[0.35rem]"
        aria-label="Workspace sections"
      >
        {routeBotId ? (
          <TrainingStatusSidebarCard
            health={health ?? null}
            botId={routeBotId}
            botKnowledgeUsage={bot?.knowledgeUsage}
          />
        ) : null}

        {/* ── Playground ── */}
        <p className="mb-2.5 ml-2.5 mt-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Playground
        </p>

        <div className="flex flex-col gap-1">
          <NavLink to={`${base}/playground/profile`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><User size={18} strokeWidth={1.75} className={iconCls(isActive)} />Profile</>}
          </NavLink>
          <NavLink to={`${base}/playground/behavior`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Sparkles size={18} strokeWidth={1.75} className={iconCls(isActive)} />Behavior</>}
          </NavLink>
          <NavLink to={`${base}/playground/capture-leads`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => (
              <>
                <ClipboardList size={18} strokeWidth={1.75} className={iconCls(isActive)} />
                Leads Capture
              </>
            )}
          </NavLink>

          {/* Knowledge Base */}
          <button type="button" className={parentBtnCls(isKnowledgeParent)} onClick={() => {
            const opening = !kbOpen;
            setKbOpen(opening);
            if (opening && !isKnowledgeParent) {
              void (async () => {
                if (await requestDiscardIfNeeded()) navigate(`${base}/playground/knowledgebase/overview`);
              })();
            }
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
                  onClick={(e) => kbKnowledgeSubNavClick(e, item.to)}
                  className={() => subCls(item.active)}
                  ref={(el) => { kbSubNavRefs.current[i] = el; }}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}

          <NavLink to={`${base}/playground/ai`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Cpu size={18} strokeWidth={1.75} className={iconCls(isActive)} />AI & Advanced</>}
          </NavLink>
          <NavLink to={`${base}/playground/translation`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Globe2 size={18} strokeWidth={1.75} className={iconCls(isActive)} />Translation</>}
          </NavLink>
          <NavLink to={`${base}/playground/chat`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => (
              <>
                <MessageCircle size={18} strokeWidth={1.75} className={iconCls(isActive)} />
                Chat Experience
              </>
            )}
          </NavLink>
          <NavLink to={`${base}/playground/appearance`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => (
              <>
                <Palette size={18} strokeWidth={1.75} className={iconCls(isActive)} />
                Widget Appearance
              </>
            )}
          </NavLink>
          <NavLink to={`${base}/playground/deploy`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><Rocket size={18} strokeWidth={1.75} className={iconCls(isActive)} />Deploy & Go Live</>}
          </NavLink>
        </div>

        {/* ── Separator ── */}
        <div className="mx-2.5 my-3" style={{ borderTop: '1px solid var(--border-soft)' }} />

        {/* ── Insights ── */}
        <p className="mb-2.5 ml-2.5 mt-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Insights
        </p>

        <div className="flex flex-col gap-1">
          <NavLink to={`${base}/insights/conversations`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><MessageSquare size={18} strokeWidth={1.75} className={iconCls(isActive)} />Chat logs</>}
          </NavLink>
          <NavLink to={`${base}/activity/leads`} onClick={guardNav} className={({ isActive }) => navCls(isActive)}>
            {({ isActive }) => <><UserCheck size={18} strokeWidth={1.75} className={iconCls(isActive)} />Leads</>}
          </NavLink>

          {/* Analytics */}
          <button type="button" className={parentBtnCls(isAnalyticsParent)} onClick={() => {
            const opening = !analyticsOpen;
            setAnalyticsOpen(opening);
            if (opening && !isAnalyticsParent) {
              void (async () => {
                if (await requestDiscardIfNeeded()) navigate(`${base}/analytics/chats`);
              })();
            }
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
