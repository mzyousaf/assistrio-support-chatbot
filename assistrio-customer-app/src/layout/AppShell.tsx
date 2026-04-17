import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronsUpDown,
  CreditCard,
  Gem,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Settings,
  Sliders,
  Sparkles,
  UserCog,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCustomerBot } from '../api/customerApi';
import type { CustomerBotDetail, CustomerMe } from '../api/types';
import { AgentWorkspaceSidebar } from '../pages/bot-workspace/AgentWorkspaceSidebar';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { customerInitials } from '../lib/customerDisplay';
import { cn } from '@/lib/utils';

const CREDITS_USED = 10;
const CREDITS_TOTAL = 50;

function navbarWorkspaceLabel(customer: CustomerMe | null): string {
  if (!customer) return 'My workspace';
  const list = customer.workspaces;
  if (list && list.length === 1) return list[0].name?.trim() || 'My workspace';
  if (list && list.length > 1) {
    const first = list[0].name?.trim() || 'Workspace';
    return `${first} (+${list.length - 1})`;
  }
  const fn = customer.firstName?.trim();
  const ln = customer.lastName?.trim();
  if (fn && ln) return `${fn} ${ln}'s workspace`;
  if (fn) return `${fn}'s workspace`;
  return 'My workspace';
}

function extractAgentId(pathname: string): string | null {
  const m = /^\/bots\/([^/]+)(?:\/|$)/.exec(pathname);
  if (!m) return null;
  return m[1];
}

function accountDisplayName(customer: CustomerMe | null): string {
  if (!customer) return 'Account';
  const n = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
  if (n) return n;
  return customer.email?.split('@')[0]?.trim() || 'Account';
}

function UserAvatar({
  picture,
  initials,
  imgFailed,
  onError,
  size = 'md',
}: {
  picture?: string;
  initials: string;
  imgFailed: boolean;
  onError: () => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[0.6rem]' : 'h-8 w-8 text-[0.65rem]';
  if (picture && !imgFailed) {
    return (
      <img
        src={picture}
        alt=""
        className={cn('block shrink-0 rounded-full object-cover ring-2 ring-white', dim)}
        onError={onError}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-700 font-bold text-white',
        dim,
      )}
    >
      {initials}
    </span>
  );
}


export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceMenuId = useId();
  const topUserMenuId = useId();

  const workspaceDetailsRef = useRef<HTMLDetailsElement>(null);
  const topUserDetailsRef = useRef<HTMLDetailsElement>(null);

  const [agentTitle, setAgentTitle] = useState<string | null>(null);
  const [agentBot, setAgentBot] = useState<CustomerBotDetail | null>(null);
  const [agentHealth, setAgentHealth] = useState<Record<string, unknown> | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    location.pathname.startsWith('/settings'),
  );

  const sidebarPeeking = sidebarCollapsed && sidebarHovered;

  const { customer, needsOnboarding, logout, logoutInFlight, logoutError, clearLogoutError } =
    useCustomerAuth();

  const wsName = navbarWorkspaceLabel(customer);
  const initials = customer ? customerInitials(customer) : '?';
  const picture = customer?.picture?.trim();
  const profileName = useMemo(() => accountDisplayName(customer), [customer]);
  const profileEmail = customer?.email?.trim() ?? '';
  const agentId = extractAgentId(location.pathname);

  useEffect(() => { setImgFailed(false); }, [picture]);
  useEffect(() => {
    if (location.pathname.startsWith('/settings')) setSettingsOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (agentId) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(userCollapsed);
    }
  }, [agentId, userCollapsed]);

  const isSettingsActive = location.pathname.startsWith('/settings');

  const settingsSubNav: [string, string, LucideIcon][] = [
    ['/settings/general', 'General', Sliders],
    ['/settings/members', 'Members', Users],
    ['/settings/plans', 'Plans', Gem],
    ['/settings/billing', 'Billing', CreditCard],
  ];
  const settingsSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const settingsTrackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  const peekSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const peekTrackRef = useRef<HTMLDivElement>(null);
  const [peekIndicator, setPeekIndicator] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const activeIdx = settingsSubNav.findIndex(([to]) => location.pathname.startsWith(to));

    const el = settingsSubNavRefs.current[activeIdx];
    const track = settingsTrackRef.current;
    if (el && track) {
      const trackRect = track.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicator({ top: elRect.top - trackRect.top + 2, height: elRect.height - 4 });
    } else {
      setIndicator(null);
    }

    const computePeek = () => {
      const pel = peekSubNavRefs.current[activeIdx];
      const ptrack = peekTrackRef.current;
      if (pel && ptrack) {
        const trackRect = ptrack.getBoundingClientRect();
        const elRect = pel.getBoundingClientRect();
        setPeekIndicator({ top: elRect.top - trackRect.top + 2, height: elRect.height - 4 });
      } else {
        setPeekIndicator(null);
      }
    };

    computePeek();
    if (sidebarPeeking) {
      const t = setTimeout(computePeek, 280);
      return () => clearTimeout(t);
    }
  }, [location.pathname, settingsOpen, sidebarCollapsed, sidebarPeeking]);


  useEffect(() => {
    if (!agentId) {
      setAgentTitle(null);
      setAgentBot(null);
      setAgentHealth(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await getCustomerBot(agentId);
      if (cancelled) return;
      if (res.ok) {
        const bot = res.data.bot as CustomerBotDetail;
        const name = String(bot?.name ?? '').trim();
        setAgentTitle(name || 'Untitled agent');
        setAgentBot(bot ?? null);
        setAgentHealth(res.data.health ?? null);
      } else {
        setAgentTitle(null);
        setAgentBot(null);
        setAgentHealth(null);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId]);

  async function handleSignOut() {
    const ok = await logout();
    workspaceDetailsRef.current?.removeAttribute('open');
    topUserDetailsRef.current?.removeAttribute('open');
    if (ok) navigate('/login', { replace: true });
  }

  function closeAllMenus() {
    workspaceDetailsRef.current?.removeAttribute('open');
    topUserDetailsRef.current?.removeAttribute('open');
  }

  const creditsPct = Math.min(100, Math.round((CREDITS_USED / CREDITS_TOTAL) * 100));

  const sideNavLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center rounded-md text-sm font-medium no-underline',
      'transition-[background-color,color,box-shadow] duration-150 ease-out',
      sidebarCollapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-[0.4375rem]',
      isActive
        ? 'nav-active font-semibold'
        : 'text-slate-500 nav-hover',
    );

  const peekNavLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium no-underline',
      'transition-[background-color,color,box-shadow] duration-150 ease-out',
      isActive
        ? 'nav-active font-semibold'
        : 'text-slate-500 nav-hover',
    );

  const sideSubNavLink = ({ isActive }: { isActive: boolean }) =>
    cn(
      'group relative flex items-center gap-2 rounded-md py-[0.375rem] pl-2.5 pr-2 text-[0.8125rem] font-medium no-underline',
      'transition-[background-color,color,box-shadow] duration-150 ease-out',
      isActive
        ? 'nav-active font-semibold'
        : 'text-slate-400 nav-hover',
    );

  return (
    <div className="flex min-h-svh flex-col text-slate-900" style={{ background: 'var(--bg-app)' }}>

      {/* ── Top Nav ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 shrink-0"
        style={{ height: 'var(--nav-height)', background: 'var(--bg-navbar)', borderBottom: '1px solid var(--border-soft)' }}
      >
        <div className="flex h-full w-full items-center justify-between gap-4 px-4">
          {/* Left */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <NavLink
              to="/bots"
              className="flex shrink-0 items-center rounded-lg leading-none focus-visible:shadow-[var(--focus-ring)]"
              aria-label="Assistrio home"
            >
              <img
                src="/logo-180x180.png"
                alt=""
                width={180}
                height={180}
                className="block h-7 w-7 object-contain"
                decoding="async"
              />
            </NavLink>

            <span className="shrink-0 select-none text-sm text-slate-200" aria-hidden>/</span>

            {/* Workspace selector */}
            <div className="inline-flex min-w-0 items-center gap-1.5">
              <span
                className="min-w-0 max-w-[14rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-800"
                title={wsName}
              >
                {wsName}
              </span>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                Free
              </span>
              <details ref={workspaceDetailsRef} className="relative min-w-0">
                <summary
                  className="inline-flex cursor-pointer list-none items-center justify-center rounded-md p-1 text-slate-400 transition-colors nav-hover [&::-webkit-details-marker]:hidden"
                  aria-label="Workspace menu"
                >
                  <ChevronsUpDown size={13} strokeWidth={1.9} aria-hidden />
                </summary>
                <div
                  id={workspaceMenuId}
                  className="absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-[14rem] rounded-xl bg-white p-1.5 shadow-[var(--shadow-dropdown)]"
                  style={{ border: '1px solid var(--border-soft)' }}
                  role="region"
                  aria-label="Workspaces"
                >
                  <p className="mb-1 px-2.5 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
                    Workspaces
                  </p>
                  {customer?.workspaces && customer.workspaces.length > 0 ? (
                    <ul className="m-0 flex flex-col gap-0.5 p-0 list-none">
                      {customer.workspaces.map((w) => (
                        <li
                          key={w.id}
                          className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 hover:bg-slate-100"
                        >
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900">
                            {w.name}
                          </span>
                          <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                            Free
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2.5 py-1.5">
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900">
                        {wsName}
                      </span>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                        Free
                      </span>
                    </div>
                  )}
                  <p className="mt-1.5 px-2.5 text-xs leading-snug text-slate-400">
                    Workspace switching coming soon.
                  </p>
                </div>
              </details>
            </div>

            {agentTitle ? (
              <>
                <span className="shrink-0 select-none text-sm text-slate-200" aria-hidden>/</span>
                <span className="inline-flex min-w-0 items-center gap-1.5 max-[900px]:hidden">
                  <span
                    className="max-w-[20rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-700"
                    title={agentTitle}
                  >
                    {agentTitle}
                  </span>
                  <span className="shrink-0 rounded-md bg-teal-50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-teal-700">
                    Agent
                  </span>
                </span>
              </>
            ) : null}
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-1">
            {logoutError ? (
              <div
                className="flex max-w-[20rem] items-center gap-2 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-1.5 text-xs text-[var(--color-danger-text)]"
                role="alert"
              >
                <span>{logoutError}</span>
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[var(--color-danger-text)] underline"
                  onClick={clearLogoutError}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {/* Help */}
            <a
              href="https://docs.assistr.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 nav-hover"
              aria-label="Documentation"
            >
              <HelpCircle size={17} strokeWidth={1.75} />
            </a>

            {/* User menu */}
            <details
              ref={topUserDetailsRef}
              className="relative [&[open]_.chevron]:rotate-180"
              onToggle={(e) => { if (e.currentTarget.open) clearLogoutError(); }}
            >
              <summary
                className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors duration-150 nav-hover [&::-webkit-details-marker]:hidden"
                aria-label="Account menu"
              >
                <UserAvatar
                  picture={picture}
                  initials={initials}
                  imgFailed={imgFailed}
                  onError={() => setImgFailed(true)}
                  size="sm"
                />
                <ChevronDown
                  className="chevron shrink-0 text-slate-400 transition-transform duration-150"
                  size={13}
                  strokeWidth={2.1}
                  aria-hidden
                />
              </summary>

              <div
                id={topUserMenuId}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl bg-white shadow-[var(--shadow-panel)]"
                style={{ border: '1px solid var(--border-soft)' }}
                role="menu"
              >
                {/* Profile header */}
                <div
                  className="flex items-center gap-3 px-3.5 py-3"
                  style={{
                    background:
                      'linear-gradient(135deg,color-mix(in srgb,#14b8a6 7%,transparent) 0%,transparent 70%),white',
                  }}
                >
                  <UserAvatar
                    picture={picture}
                    initials={initials}
                    imgFailed={imgFailed}
                    onError={() => setImgFailed(true)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                      {profileName}
                    </p>
                    {profileEmail && (
                      <p className="truncate text-xs text-slate-400">{profileEmail}</p>
                    )}
                  </div>
                </div>

                <div className="h-px bg-slate-200" role="separator" />

                <div className="flex flex-col gap-0.5 p-1.5">
                  {(
                    [
                      ['/bots', LayoutDashboard, 'Dashboard'],
                      ['/settings/general', UserCog, 'Account settings'],
                      ['/settings/billing', CreditCard, 'Billing & plans'],
                    ] as const
                  ).map(([to, Icon, label]) => (
                    <NavLink
                      key={to}
                      to={to}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 no-underline transition-colors duration-150 nav-hover"
                      role="menuitem"
                      onClick={closeAllMenus}
                    >
                      <Icon size={15} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                      {label}
                    </NavLink>
                  ))}
                </div>

                <div className="h-px bg-slate-200" role="separator" />

                <div className="p-1.5">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-md border-none bg-transparent px-2.5 py-1.5 text-left font-[inherit] text-sm font-medium text-red-600 transition-colors duration-150 hover:enabled:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    role="menuitem"
                    disabled={logoutInFlight}
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
                    {logoutInFlight ? 'Signing out…' : 'Sign out'}
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div
        className="flex min-h-0 flex-1 max-[900px]:flex-col"
        style={{ minHeight: 'calc(100vh - var(--nav-height))' }}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            'relative flex shrink-0 flex-col transition-[width] duration-200 ease-out max-[900px]:w-full max-[900px]:border-b',
          )}
          style={{ background: 'var(--bg-sidebar-primary)', borderRight: '1px solid var(--border-sidebar)', width: sidebarCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}
          aria-label="Application"
          onMouseEnter={() => {
            if (!sidebarCollapsed) return;
            clearTimeout(sidebarHoverTimer.current);
            sidebarHoverTimer.current = setTimeout(() => setSidebarHovered(true), 120);
          }}
          onMouseLeave={() => {
            clearTimeout(sidebarHoverTimer.current);
            setSidebarHovered(false);
          }}
        >
          {/* Peek drawer — slides open from the left edge when collapsed + hovered */}
          {sidebarCollapsed && (
            <>
              <nav
                className={cn(
                  'absolute inset-y-0 left-0 z-30 flex flex-col overflow-hidden',
                  'transition-[width,box-shadow] duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
                  sidebarPeeking
                    ? 'w-[var(--sidebar-width)] shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)]'
                    : 'pointer-events-none w-0',
                )}
                style={{ background: 'var(--bg-sidebar-primary)', borderRight: '1px solid var(--border-sidebar)' }}
                aria-label="Main"
              >
                <div className="flex min-w-[var(--sidebar-width)] flex-1 flex-col overflow-y-auto overflow-x-hidden p-3">
                  {/* Nav links */}
                  <div className="mb-1 flex flex-col gap-1">
                    <NavLink to="/bots" className={peekNavLink}>
                      {({ isActive }) => (
                        <>
                          <Sparkles size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                          Agents
                        </>
                      )}
                    </NavLink>
                    <NavLink to="/usage" className={peekNavLink}>
                      {({ isActive }) => (
                        <>
                          <Gauge size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                          Usage
                        </>
                      )}
                    </NavLink>
                    {needsOnboarding && (
                      <NavLink to="/onboarding" className={peekNavLink}>
                        {({ isActive }) => (
                          <>
                            <UserCog size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                            Setup
                          </>
                        )}
                      </NavLink>
                    )}
                  </div>

                  {/* Settings */}
                  <div>
                    <button
                      type="button"
                      className={cn(
                        'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium cursor-pointer border-none bg-transparent text-left',
                        'transition-[background-color,color] duration-150 ease-out',
                        isSettingsActive
                          ? 'font-semibold text-[var(--active-text)]'
                          : 'text-slate-500 nav-hover',
                      )}
                      onClick={() => {
                        const opening = !settingsOpen;
                        setSettingsOpen(opening);
                        if (opening && !isSettingsActive) navigate('/settings/general');
                      }}
                    >
                      <Settings size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isSettingsActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                      <span className="flex-1">Settings</span>
                      <ChevronDown size={14} strokeWidth={1.8} className={cn('shrink-0 text-slate-300 transition-transform duration-200', settingsOpen && 'rotate-180')} aria-hidden />
                    </button>
                    {settingsOpen && (
                      <div
                        ref={peekTrackRef}
                        className="relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3"
                      >
                        <div className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full" style={{ background: 'var(--border-soft)' }} aria-hidden />
                        {peekIndicator && (
                          <div
                            className="absolute left-0 w-[2px] rounded-full bg-teal-500"
                            style={{
                              top: peekIndicator.top,
                              height: peekIndicator.height,
                              transition: 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
                            }}
                            aria-hidden
                          />
                        )}
                        {settingsSubNav.map(([to, label, Icon], i) => (
                          <NavLink
                            key={to}
                            to={to}
                            className={sideSubNavLink}
                            ref={(el) => { peekSubNavRefs.current[i] = el; }}
                          >
                            {({ isActive }) => (
                              <>
                                <Icon size={15} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                                {label}
                              </>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Credits in peek */}
                <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Credits</span>
                    <span className="text-xs font-semibold tabular-nums text-slate-400">{CREDITS_USED}/{CREDITS_TOTAL}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all" style={{ width: `${creditsPct}%` }} />
                  </div>
                  <NavLink
                    to="/settings/plans"
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]"
                  >
                    <Zap size={12} className="shrink-0 fill-white" aria-hidden />
                    Upgrade
                  </NavLink>
                </div>
              </nav>
            </>
          )}

          {/* Main nav — normal (expanded or collapsed icons) */}
          <nav
            className={cn(
              'flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-3 max-[900px]:w-full max-[900px]:flex-row max-[900px]:flex-wrap max-[900px]:p-2',
              sidebarCollapsed && 'items-center px-1.5',
            )}
            aria-label="Main"
          >
            <div className={cn('mb-1 flex flex-col gap-1', sidebarCollapsed && 'w-full items-center')}>
              <NavLink to="/bots" className={sideNavLink} title={sidebarCollapsed ? 'Agents' : undefined}>
                {({ isActive }) => (
                  <>
                    <Sparkles
                      size={18}
                      strokeWidth={1.75}
                      className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
                      aria-hidden
                    />
                    {!sidebarCollapsed && 'Agents'}
                  </>
                )}
              </NavLink>

              <NavLink to="/usage" className={sideNavLink} title={sidebarCollapsed ? 'Usage' : undefined}>
                {({ isActive }) => (
                  <>
                    <Gauge
                      size={18}
                      strokeWidth={1.75}
                      className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
                      aria-hidden
                    />
                    {!sidebarCollapsed && 'Usage'}
                  </>
                )}
              </NavLink>

              {needsOnboarding ? (
                <NavLink to="/onboarding" className={sideNavLink} title={sidebarCollapsed ? 'Setup' : undefined}>
                  {({ isActive }) => (
                    <>
                      <UserCog
                        size={18}
                        strokeWidth={1.75}
                        className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
                        aria-hidden
                      />
                      {!sidebarCollapsed && 'Setup'}
                    </>
                  )}
                </NavLink>
              ) : null}
            </div>

            {/* Workspace Settings */}
            {sidebarCollapsed ? (
              <div className="flex w-full flex-col items-center gap-1">
                {/* Settings icon only — no sub-nav when collapsed */}
                <NavLink
                  to="/settings/general"
                  className={sideNavLink}
                  title="Settings"
                >
                  {({ isActive }) => (
                    <Settings
                      size={18}
                      strokeWidth={1.75}
                      className={cn('shrink-0 transition-colors duration-150', isActive || isSettingsActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
                      aria-hidden
                    />
                  )}
                </NavLink>
              </div>
            ) : (
              <div className="max-[900px]:flex max-[900px]:flex-wrap max-[900px]:gap-0.5">
                <button
                  type="button"
                  className={cn(
                    'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium cursor-pointer border-none bg-transparent text-left',
                    'transition-[background-color,color] duration-150 ease-out',
                    isSettingsActive
                      ? 'font-semibold text-[var(--active-text)]'
                      : 'text-slate-500 nav-hover',
                  )}
                  onClick={() => {
                    const opening = !settingsOpen;
                    setSettingsOpen(opening);
                    if (opening && !isSettingsActive) navigate('/settings/general');
                  }}
                >
                  <Settings
                    size={18}
                    strokeWidth={1.75}
                    className={cn('shrink-0 transition-colors duration-150', isSettingsActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')}
                    aria-hidden
                  />
                  <span className="flex-1">Workspace Settings</span>
                  <ChevronDown
                    size={14}
                    strokeWidth={1.8}
                    className={cn(
                      'shrink-0 text-slate-300 transition-transform duration-200',
                      settingsOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {settingsOpen && (
                  <div
                    ref={settingsTrackRef}
                    className="relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3 max-[900px]:ml-0"
                  >
                    {/* Track bar */}
                    <div
                      className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full max-[900px]:hidden"
                      style={{ background: 'var(--border-soft)' }}
                      aria-hidden
                    />
                    {/* Sliding active indicator */}
                    {indicator && (
                      <div
                        className="absolute left-0 w-[2px] rounded-full bg-teal-500 max-[900px]:hidden"
                        style={{
                          top: indicator.top,
                          height: indicator.height,
                          transition: 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
                        }}
                        aria-hidden
                      />
                    )}
                    {settingsSubNav.map(([to, label, Icon], i) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={sideSubNavLink}
                        ref={(el) => { settingsSubNavRefs.current[i] = el; }}
                      >
                        {({ isActive }) => (
                          <>
                            <Icon
                              size={15}
                              strokeWidth={1.75}
                              className={cn(
                                'shrink-0 transition-colors duration-150',
                                isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600',
                              )}
                              aria-hidden
                            />
                            {label}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* ── Sidebar bottom ── */}
          <div className="shrink-0 max-[900px]:hidden">
            {!sidebarCollapsed && (
              <div className="px-3 pb-2">
                {/* Credits + Upgrade */}
                <div className="mb-3 overflow-hidden rounded-xl shadow-[var(--shadow-card)]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
                  {/* Usage bar */}
                  <div className="p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Credits</span>
                      <span className="text-xs font-semibold tabular-nums text-slate-400">
                        {CREDITS_USED}/{CREDITS_TOTAL}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all"
                        style={{ width: `${creditsPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="p-3" style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-sidebar-secondary)' }}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Zap
                        size={13}
                        className="shrink-0 fill-amber-400 text-amber-400"
                        aria-hidden
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        Upgrade to Pro
                      </span>
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-slate-400">
                      Get 5k messages, remove branding &amp; priority support.
                    </p>
                    <NavLink
                      to="/settings/plans"
                      className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]"
                    >
                      <Zap size={12} className="shrink-0 fill-white" aria-hidden />
                      Upgrade
                    </NavLink>
                  </div>
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* Sidebar collapse/expand handle — hidden when agent detail is open */}
        {!agentId && (
          <button
            type="button"
            className="group relative z-10 flex w-3 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 max-[900px]:hidden"
            onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              setUserCollapsed(next);
            }}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <div className="h-8 w-[3px] rounded-full transition-all duration-200 group-hover:h-12" style={{ background: 'var(--border-sidebar)' }} />
          </button>
        )}

        {/* Agent workspace sidebar — renders immediately, bot details fill in async */}
        {agentId && (
          <AgentWorkspaceSidebar bot={agentBot} health={agentHealth} />
        )}

        {/* Workspace canvas — routes supply centered containers and page intros */}
        <main
          className="min-w-0 flex-1 overflow-x-visible overflow-y-auto"
          style={{ background: 'var(--bg-workspace-canvas)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
