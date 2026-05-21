import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  Check,
  Database,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  CreditCard,
  Gem,
  Gauge,
  Globe2,
  HelpCircle,
  Info,
  LayoutDashboard,
  Link2,
  LogOut,
  PencilLine,
  Rocket,
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
import { getCustomerApiOrigin } from '../api/client';
import type { CustomerBotDetail, CustomerMe, CustomerShareLinkResponse } from '../api/types';
import { AgentWorkspaceSidebar } from '../pages/bot-workspace/AgentWorkspaceSidebar';
import { SharePreviewModal } from '../pages/bot-workspace/SharePreviewModal';
import { useWorkspaceDiscardModal } from '../pages/bot-workspace/WorkspaceDiscardModal';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCustomerLogout } from '../auth/useCustomerLogout';
import { customerInitials } from '../lib/customerDisplay';
import { widgetSnippet } from '../lib/embedOrigin';
import { BotLifecycleModal } from '../components/BotLifecycleModal';
import { BotLifecycleProvider } from '../context/BotLifecycleContext';
import { KbWorkspacePollingProvider } from '../context/KbWorkspacePollingContext';
import { Modal } from '../components/ui/Modal';
import { ASSISTRIO_NAVBAR_BOT_REFRESH, requestWorkspaceBotRefresh } from '../lib/botSyncEvents';
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

function relTrainedAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'never';
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

function AgentInfoPopover({
  agentTitle,
  currentStatus,
  trainedAgo,
  visibilityLabel,
  notesBytes,
  qaBytes,
  docsIndexedBytes,
  dataSourcesLifecycleDotClassName,
  dataSourcesLifecycleLabelClassName,
  dataSourcesLifecycleLabel,
  onSetDraft,
  onSetPublished,
  disableDraft,
  disablePublished,
  canPublishFromNavbar,
  onCopyEmbed,
  disableCopyEmbed,
  copyEmbedTitle,
}: {
  agentTitle: string | null;
  currentStatus: 'draft' | 'published';
  trainedAgo: string;
  visibilityLabel: string;
  notesBytes: number;
  qaBytes: number;
  docsIndexedBytes: number;
  dataSourcesLifecycleDotClassName: string;
  dataSourcesLifecycleLabelClassName: string;
  dataSourcesLifecycleLabel: string;
  onSetDraft: () => void;
  onSetPublished: () => void;
  disableDraft: boolean;
  disablePublished: boolean;
  canPublishFromNavbar: boolean;
  onCopyEmbed: () => void;
  disableCopyEmbed: boolean;
  copyEmbedTitle: string;
}) {
  return (
    <div
      className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-xl bg-white p-4 shadow-[var(--shadow-dropdown)]"
      style={{ border: '1px solid var(--border-soft)' }}
      role="region"
      aria-label="Agent details"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 truncate text-sm font-semibold text-slate-900" title={agentTitle ?? undefined}>
          {agentTitle}
        </p>
        <button
          type="button"
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition-colors',
            disableCopyEmbed
              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100',
          )}
          onClick={onCopyEmbed}
          disabled={disableCopyEmbed}
          title={copyEmbedTitle}
        >
          <Copy size={11} strokeWidth={2} className="shrink-0" aria-hidden />
          Embed
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[5.25rem_1fr] gap-x-4 gap-y-3 text-xs leading-snug">
        <span className="inline-flex h-6 items-center font-medium text-slate-500">Status</span>
        <span
          className="inline-flex h-6 min-w-[8.6rem] items-center justify-self-end rounded-md border border-slate-200/90 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
          role="radiogroup"
          aria-label="Agent status"
        >
          <button
            type="button"
            role="radio"
            aria-checked={currentStatus === 'draft'}
            className={cn(
              'inline-flex h-5 flex-1 items-center justify-center whitespace-nowrap rounded px-2 text-[10px] font-semibold transition-colors',
              currentStatus === 'draft'
                ? 'bg-slate-200/80 text-slate-800'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
              disableDraft && currentStatus !== 'draft' && 'cursor-default opacity-70',
            )}
            onClick={onSetDraft}
            disabled={disableDraft}
            title={currentStatus === 'draft' ? 'Agent currently in draft' : 'Move this agent back to draft'}
          >
            <PencilLine
              size={10}
              strokeWidth={2}
              className={cn('mr-1 shrink-0', currentStatus === 'draft' ? 'text-slate-600' : 'text-slate-400')}
              aria-hidden
            />
            Draft
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={currentStatus === 'published'}
            className={cn(
              'inline-flex h-5 flex-1 items-center justify-center whitespace-nowrap rounded px-2 text-[10px] font-semibold transition-colors',
              currentStatus === 'published'
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
              disablePublished && currentStatus !== 'published' && 'cursor-default opacity-70',
            )}
            onClick={onSetPublished}
            disabled={disablePublished}
            title={
              currentStatus === 'published'
                ? 'Agent is live'
                : canPublishFromNavbar
                  ? 'Go live with this agent'
                  : 'Go live — complete requirements first if prompted'
            }
          >
            <Rocket size={10} strokeWidth={2} className="mr-1 shrink-0" aria-hidden />
            Go Live
          </button>
        </span>
        <span className="font-medium text-slate-500">Visibility</span>
        <span className="inline-flex items-center justify-self-end gap-1.5 text-right font-semibold text-slate-600">
          <Globe2 size={12} strokeWidth={1.9} aria-hidden />
          {visibilityLabel}
        </span>
      </div>

      <div className="mt-5 border-t border-slate-200/90 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <Database size={12} strokeWidth={1.9} aria-hidden />
            Data sources
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-medium',
              dataSourcesLifecycleLabelClassName,
            )}
          >
            <span
              className={cn('h-2 w-2 rounded-full', dataSourcesLifecycleDotClassName)}
              aria-hidden
            />
            {dataSourcesLifecycleLabel}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Last trained {trainedAgo}</div>
        <div className="mt-2 grid grid-cols-[5.25rem_1fr] gap-x-4 gap-y-1.5 text-xs leading-snug">
          <span className="font-medium text-slate-500">Notes</span>
          <span className="justify-self-end text-right font-semibold text-slate-600">{formatBytesCompact(notesBytes)}</span>
          <span className="font-medium text-slate-500">Q&amp;A</span>
          <span className="justify-self-end text-right font-semibold text-slate-600">{formatBytesCompact(qaBytes)}</span>
          <span className="font-medium text-slate-500">Documents</span>
          <span className="justify-self-end text-right font-semibold text-slate-600">{formatBytesCompact(docsIndexedBytes)}</span>
        </div>
      </div>
    </div>
  );
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
  const agentInfoDetailsRef = useRef<HTMLDetailsElement>(null);

  const [agentTitle, setAgentTitle] = useState<string | null>(null);
  const [agentBot, setAgentBot] = useState<CustomerBotDetail | null>(null);
  const [agentHealth, setAgentHealth] = useState<Record<string, unknown> | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<'publish' | 'draft' | null>(null);
  const [lifecycleRunKey, setLifecycleRunKey] = useState(0);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const statusToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [publishRequirementsOpen, setPublishRequirementsOpen] = useState(false);
  const [lifecycleConfirmOpen, setLifecycleConfirmOpen] = useState(false);
  const [lifecycleConfirmAction, setLifecycleConfirmAction] = useState<'publish' | 'draft' | null>(null);
  const [agentInfoExpanded, setAgentInfoExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    location.pathname.startsWith('/settings'),
  );
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);

  const sidebarPeeking = sidebarCollapsed && sidebarHovered;

  const { customer, needsOnboarding } = useCustomerAuth();
  const { signOut, logoutInFlight, logoutError, clearLogoutError } = useCustomerLogout();

  const wsName = navbarWorkspaceLabel(customer);
  const initials = customer ? customerInitials(customer) : '?';
  const picture = customer?.picture?.trim();
  const profileName = useMemo(() => accountDisplayName(customer), [customer]);
  const profileEmail = customer?.email?.trim() ?? '';
  const agentId = extractAgentId(location.pathname);
  const isAgentWorkspace = Boolean(agentId);

  const { requestDiscardIfNeeded } = useWorkspaceDiscardModal();

  const workspaceLeaveGuard = useCallback(
    (e: MouseEvent, href: string) => {
      if (!agentId) return;
      const base = `/bots/${agentId}`;
      if (!location.pathname.startsWith(`${base}/`) && location.pathname !== base) return;
      const path = href.split('#')[0]?.split('?')[0] ?? href;
      if (path.startsWith(base)) return;
      e.preventDefault();
      void (async () => {
        if (await requestDiscardIfNeeded()) navigate(path);
      })();
    },
    [agentId, location.pathname, navigate, requestDiscardIfNeeded],
  );
  const currentStatus = String(agentBot?.status ?? '').toLowerCase() === 'published' ? 'published' : 'draft';
  const visibilityLabel = String(agentBot?.visibility ?? '').toLowerCase() === 'private' ? 'Private' : 'Public';
  const canPublishFromNavbar = Boolean(
    String(agentBot?.name ?? '').trim() &&
      String(agentBot?.description ?? '').trim() &&
      (agentBot?.allowedOrigins ?? []).some((o) => o?.isActive !== false && String(o?.origin ?? '').trim()),
  );
  const lastTrainedAt = healthIsoString(agentHealth, 'lastIngestedAt');
  const docsPending = healthNum(agentHealth, 'docsPending');
  const docsQueued = healthNum(agentHealth, 'docsQueued');
  const docsProcessing = healthNum(agentHealth, 'docsProcessing');
  const docsIndexedBytes = healthNum(agentHealth, 'docsIndexedBytes');
  const dataSourcesLifecycleLabel =
    docsProcessing > 0 ? 'Training' : docsQueued > 0 ? 'Training Queued' : docsPending > 0 ? 'Training Required' : 'Trained';
  const dataSourcesLifecycleLabelClassName =
    docsProcessing > 0
      ? 'text-blue-900'
      : docsQueued > 0
        ? 'text-yellow-900'
        : docsPending > 0
          ? 'text-orange-900'
          : 'text-emerald-800';
  const dataSourcesLifecycleDotClassName =
    docsProcessing > 0
      ? 'animate-pulse bg-blue-500'
      : docsQueued > 0
        ? 'animate-pulse bg-yellow-500'
        : docsPending > 0
          ? 'animate-pulse bg-orange-500'
          : 'bg-emerald-500';
  const trainedAgo = relTrainedAgo(lastTrainedAt);
  const notesBytes = useMemo(() => {
    if (!agentBot) return 0;
    const b = agentBot as { knowledgeSnippets?: { title?: string; snippet?: string }[]; knowledgeDescription?: string };
    if (Array.isArray(b.knowledgeSnippets) && b.knowledgeSnippets.length > 0) {
      return b.knowledgeSnippets.reduce((n, s) => {
        const t = String(s?.title ?? '') + String(s?.snippet ?? '');
        return n + new TextEncoder().encode(t).length;
      }, 0);
    }
    return new TextEncoder().encode(String(b.knowledgeDescription ?? '')).length;
  }, [agentBot]);
  const qaBytes = useMemo(() => {
    const faqs = Array.isArray(agentBot?.faqs) ? agentBot.faqs : [];
    return faqs.reduce((sum, row) => {
      const o = row as { title?: unknown; questions?: unknown; question?: unknown; answer?: unknown };
      const title = String(o.title ?? '');
      const qJoin = Array.isArray(o.questions) ? o.questions.map((x) => String(x)).join('') : String(o.question ?? '');
      const a = String(o.answer ?? '');
      return sum + title.length + qJoin.length + a.length;
    }, 0);
  }, [agentBot?.faqs]);
  const missingPublishChecks = useMemo(() => {
    const missing: string[] = [];
    if (!String(agentBot?.name ?? '').trim()) missing.push('Agent name is required.');
    if (!String(agentBot?.description ?? '').trim()) missing.push('Agent description is required.');
    const hasActiveOrigin = (agentBot?.allowedOrigins ?? []).some(
      (o) => o?.isActive !== false && String(o?.origin ?? '').trim(),
    );
    if (!hasActiveOrigin) missing.push('At least one active allowed origin is required.');
    return missing;
  }, [agentBot]);

  useEffect(() => { setImgFailed(false); }, [picture]);
  useEffect(() => {
    if (location.pathname.startsWith('/settings')) setSettingsOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const details = agentInfoDetailsRef.current;
      if (!details?.open) return;
      const target = event.target;
      if (target instanceof Node && !details.contains(target)) {
        details.removeAttribute('open');
        setAgentInfoExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    setLifecycleConfirmOpen(false);
    setLifecycleConfirmAction(null);
  }, [location.pathname]);

  useEffect(() => {
    if (agentId) {
      setSidebarCollapsed(true);
    } else {
      setSidebarCollapsed(userCollapsed);
    }
  }, [agentId, userCollapsed]);

  const isSettingsActive = location.pathname.startsWith('/settings');
  /** Datasheet full-screen editor: only top nav, edge-to-edge below (see `PlaygroundLayout` widget hidden). */
  const hideAgentWorkspaceChrome = /\/playground\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(
    location.pathname,
  );

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
      setPublishRequirementsOpen(false);
      setLifecycleConfirmOpen(false);
      setLifecycleConfirmAction(null);
      setLifecycleOpen(false);
      setLifecycleAction(null);
      setAgentInfoExpanded(false);
      setSharePreviewOpen(false);
      agentInfoDetailsRef.current?.removeAttribute('open');
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
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function handleSignOut() {
    await signOut({
      beforeNavigate: () => {
        workspaceDetailsRef.current?.removeAttribute('open');
        topUserDetailsRef.current?.removeAttribute('open');
      },
    });
  }

  function closeAllMenus() {
    workspaceDetailsRef.current?.removeAttribute('open');
    topUserDetailsRef.current?.removeAttribute('open');
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
  }

  const creditsPct = Math.min(100, Math.round((CREDITS_USED / CREDITS_TOTAL) * 100));

  useEffect(() => {
    return () => {
      if (statusToastTimerRef.current) clearTimeout(statusToastTimerRef.current);
    };
  }, []);

  function showStatusToast(msg: string) {
    setStatusToast(msg);
    if (statusToastTimerRef.current) clearTimeout(statusToastTimerRef.current);
    statusToastTimerRef.current = setTimeout(() => setStatusToast(null), 2200);
  }

  const refreshAgentFromApi = useCallback(async () => {
    if (!agentId) return;
    const refreshed = await getCustomerBot(agentId);
    if (refreshed.ok) {
      const bot = refreshed.data.bot as CustomerBotDetail;
      const name = String(bot?.name ?? '').trim();
      setAgentTitle(name || 'Untitled agent');
      setAgentBot(bot ?? null);
      setAgentHealth(refreshed.data.health ?? null);
    }
  }, [agentId]);

  const onSharePreviewUpdated = useCallback((share: CustomerShareLinkResponse) => {
    setAgentBot((prev) => {
      if (!prev) return prev;
      const secureSharePreviewConfigured =
        typeof share.secureSharePreviewConfigured === 'boolean'
          ? share.secureSharePreviewConfigured
          : Boolean(share.slug?.trim() && share.expiresAt);
      return {
        ...prev,
        shareChat: {
          enabled: share.enabled,
          slug: share.slug,
          expiresAt: share.expiresAt ?? null,
          requiresPreviewToken: true,
          ...(typeof share.allowDraft === 'boolean' ? { allowDraft: share.allowDraft } : {}),
          secureSharePreviewConfigured,
          tokenRevokedAt: share.tokenRevokedAt ?? null,
        },
      };
    });
  }, []);

  const onLifecycleModalSuccess = useCallback(() => {
    if (!agentId) return;
    void (async () => {
      await refreshAgentFromApi();
      requestWorkspaceBotRefresh(agentId);
    })();
  }, [agentId, refreshAgentFromApi]);

  const openPublishLifecycle = useCallback(() => {
    if (!agentId || currentStatus === 'published' || lifecycleBusy) return;
    if (!canPublishFromNavbar) {
      setPublishRequirementsOpen(true);
      return;
    }
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    setLifecycleConfirmAction('publish');
    setLifecycleConfirmOpen(true);
  }, [agentId, currentStatus, lifecycleBusy, canPublishFromNavbar]);

  const openDraftLifecycle = useCallback(() => {
    if (!agentId || currentStatus === 'draft' || lifecycleBusy) return;
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    setLifecycleConfirmAction('draft');
    setLifecycleConfirmOpen(true);
  }, [agentId, currentStatus, lifecycleBusy]);

  const cancelLifecycleConfirm = useCallback(() => {
    setLifecycleConfirmOpen(false);
    setLifecycleConfirmAction(null);
  }, []);

  const confirmLifecycleTransition = useCallback(() => {
    const act = lifecycleConfirmAction;
    setLifecycleConfirmOpen(false);
    setLifecycleConfirmAction(null);
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    if (!agentId || lifecycleBusy) return;
    if (act === 'publish') {
      if (currentStatus === 'published') return;
      if (!canPublishFromNavbar) {
        setPublishRequirementsOpen(true);
        return;
      }
      setLifecycleAction('publish');
      setLifecycleRunKey((k) => k + 1);
      setLifecycleOpen(true);
    } else if (act === 'draft') {
      if (currentStatus === 'draft') return;
      setLifecycleAction('draft');
      setLifecycleRunKey((k) => k + 1);
      setLifecycleOpen(true);
    }
  }, [
    lifecycleConfirmAction,
    agentId,
    lifecycleBusy,
    currentStatus,
    canPublishFromNavbar,
  ]);

  const lifecycleControls = useMemo(
    () => ({
      openPublish: openPublishLifecycle,
      openDraft: openDraftLifecycle,
    }),
    [openPublishLifecycle, openDraftLifecycle],
  );

  useEffect(() => {
    if (!agentId) return;
    const onNavRefresh = (e: Event) => {
      const id = (e as CustomEvent<{ botId?: string }>).detail?.botId;
      if (id === agentId) void refreshAgentFromApi();
    };
    window.addEventListener(ASSISTRIO_NAVBAR_BOT_REFRESH, onNavRefresh);
    return () => window.removeEventListener(ASSISTRIO_NAVBAR_BOT_REFRESH, onNavRefresh);
  }, [agentId, refreshAgentFromApi]);

  async function copyEmbedFromPopover() {
    if (!agentBot || !agentId || currentStatus !== 'published') return;
    const visibility = String(agentBot.visibility ?? '').toLowerCase() === 'private' ? 'private' : 'public';
    const embed = widgetSnippet({
      botId: agentId,
      apiBaseUrl: getCustomerApiOrigin(),
      accessKey: String(agentBot.accessKey ?? ''),
      ...(visibility === 'private' && String(agentBot.secretKey ?? '').trim()
        ? { secretKey: String(agentBot.secretKey) }
        : {}),
      visibility,
      widgetAssetOrigin:
        (import.meta.env.VITE_WIDGET_ASSET_ORIGIN ?? '').replace(/\/$/, '') || 'https://widget.assistrio.com',
    });
    try {
      await navigator.clipboard.writeText(embed);
      showStatusToast('Embed code copied.');
      agentInfoDetailsRef.current?.removeAttribute('open');
      setAgentInfoExpanded(false);
    } catch {
      showStatusToast('Could not copy embed code.');
    }
  }

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

  const workspaceOutlet = useMemo(
    () => (
      <main
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-visible',
          hideAgentWorkspaceChrome
            ? 'h-[calc(100dvh-var(--nav-height))] min-h-0 overflow-y-hidden'
            : 'overflow-y-auto',
        )}
        style={{ background: 'var(--bg-workspace-canvas)' }}
      >
        <BotLifecycleProvider value={lifecycleControls}>
          <Outlet />
        </BotLifecycleProvider>
      </main>
    ),
    [hideAgentWorkspaceChrome, lifecycleControls],
  );

  return (
    <div
      className={cn(
        'flex flex-col text-slate-900',
        agentId ? 'h-svh min-h-0 overflow-hidden' : 'min-h-svh',
      )}
      style={{ background: 'var(--bg-app)' }}
    >

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
                <span className="inline-flex min-w-0 items-center gap-1.5 align-middle max-[900px]:hidden">
                  <span
                    className="max-w-[20rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm leading-5 font-medium text-slate-700"
                    title={agentTitle}
                  >
                    {agentTitle}
                  </span>
                  <details
                    ref={agentInfoDetailsRef}
                    className="relative"
                    onToggle={(e) => setAgentInfoExpanded(e.currentTarget.open)}
                  >
                    <summary
                      className="inline-flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-md p-0 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 [&::-webkit-details-marker]:hidden"
                      aria-label="Agent details"
                      aria-expanded={agentInfoExpanded}
                    >
                      <Info size={13} strokeWidth={2} aria-hidden />
                    </summary>
                    <AgentInfoPopover
                      agentTitle={agentTitle}
                      currentStatus={currentStatus}
                      trainedAgo={trainedAgo}
                      visibilityLabel={visibilityLabel}
                      notesBytes={notesBytes}
                      qaBytes={qaBytes}
                      docsIndexedBytes={docsIndexedBytes}
                      dataSourcesLifecycleDotClassName={dataSourcesLifecycleDotClassName}
                      dataSourcesLifecycleLabelClassName={dataSourcesLifecycleLabelClassName}
                      dataSourcesLifecycleLabel={dataSourcesLifecycleLabel}
                      onSetDraft={openDraftLifecycle}
                      onSetPublished={openPublishLifecycle}
                      disableDraft={lifecycleBusy || currentStatus === 'draft'}
                      disablePublished={lifecycleBusy || currentStatus === 'published'}
                      canPublishFromNavbar={canPublishFromNavbar}
                      onCopyEmbed={() => void copyEmbedFromPopover()}
                      disableCopyEmbed={currentStatus !== 'published'}
                      copyEmbedTitle={
                        currentStatus === 'published'
                          ? 'Copy embed code'
                          : 'Publish this agent to copy the embed code.'
                      }
                    />
                  </details>
                </span>
              </>
            ) : null}
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-2">
            {isAgentWorkspace ? (
              <>
                <button
                  type="button"
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setSharePreviewOpen(true)}
                  disabled={!agentBot}
                  title="Share an Assistrio-hosted preview link."
                >
                  <Link2 size={14} strokeWidth={2} className="shrink-0 text-slate-600" aria-hidden />
                  Share Agent Preview
                </button>
                <div
                  className="inline-flex h-8 min-w-[9.5rem] items-center rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                  role="radiogroup"
                  aria-label="Agent status"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={currentStatus === 'draft'}
                    className={cn(
                      'inline-flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-[background-color,color] duration-150',
                      currentStatus === 'draft'
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                      (lifecycleBusy || currentStatus === 'draft') && 'cursor-default',
                    )}
                    onClick={openDraftLifecycle}
                    disabled={lifecycleBusy || currentStatus === 'draft'}
                    title={currentStatus === 'draft' ? 'Agent currently in draft' : 'Move agent to draft'}
                  >
                    <PencilLine size={12} strokeWidth={2} className="mr-1 shrink-0" aria-hidden />
                    {lifecycleBusy && lifecycleAction === 'draft' ? 'Going to draft…' : 'Draft'}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={currentStatus === 'published'}
                    className={cn(
                      'inline-flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-[background-color,color] duration-150',
                      currentStatus === 'published'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                      (lifecycleBusy || currentStatus === 'published') && 'cursor-default',
                    )}
                    onClick={openPublishLifecycle}
                    disabled={lifecycleBusy || currentStatus === 'published'}
                    title={
                      currentStatus === 'published'
                        ? 'Agent is live'
                        : canPublishFromNavbar
                          ? 'Go live with this agent'
                          : 'Go live — complete requirements first if prompted'
                    }
                  >
                    <Rocket size={12} strokeWidth={2} className="mr-1 shrink-0" aria-hidden />
                    {lifecycleBusy && lifecycleAction === 'publish' ? 'Going live…' : 'Go Live'}
                  </button>
                </div>
                {statusToast ? (
                  <span className="hidden items-center gap-1 text-xs text-teal-700 sm:inline-flex" role="status" aria-live="polite">
                    <CheckCircle2 size={13} strokeWidth={2} aria-hidden />
                    {statusToast}
                  </span>
                ) : null}
              </>
            ) : null}

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
            hideAgentWorkspaceChrome && 'hidden',
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
                    <NavLink to="/bots" className={peekNavLink} onClick={(e) => workspaceLeaveGuard(e, '/bots')}>
                      {({ isActive }) => (
                        <>
                          <Sparkles size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                          Agents
                        </>
                      )}
                    </NavLink>
                    <NavLink to="/usage" className={peekNavLink} onClick={(e) => workspaceLeaveGuard(e, '/usage')}>
                      {({ isActive }) => (
                        <>
                          <Gauge size={18} strokeWidth={1.75} className={cn('shrink-0 transition-colors duration-150', isActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600')} aria-hidden />
                          Usage
                        </>
                      )}
                    </NavLink>
                    {needsOnboarding && (
                      <NavLink
                        to="/onboarding"
                        className={peekNavLink}
                        onClick={(e) => workspaceLeaveGuard(e, '/onboarding')}
                      >
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
                            onClick={(e) => workspaceLeaveGuard(e, to)}
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
                    onClick={(e) => workspaceLeaveGuard(e, '/settings/plans')}
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
              <NavLink
                to="/bots"
                className={sideNavLink}
                title={sidebarCollapsed ? 'Agents' : undefined}
                onClick={(e) => workspaceLeaveGuard(e, '/bots')}
              >
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

              <NavLink
                to="/usage"
                className={sideNavLink}
                title={sidebarCollapsed ? 'Usage' : undefined}
                onClick={(e) => workspaceLeaveGuard(e, '/usage')}
              >
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
                <NavLink
                  to="/onboarding"
                  className={sideNavLink}
                  title={sidebarCollapsed ? 'Setup' : undefined}
                  onClick={(e) => workspaceLeaveGuard(e, '/onboarding')}
                >
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
                  onClick={(e) => workspaceLeaveGuard(e, '/settings/general')}
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
                        onClick={(e) => workspaceLeaveGuard(e, to)}
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
                      onClick={(e) => workspaceLeaveGuard(e, '/settings/plans')}
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
        {!agentId && !hideAgentWorkspaceChrome && (
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

        {agentId ? (
          <KbWorkspacePollingProvider botId={agentId}>
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden max-[900px]:flex-col">
              {!hideAgentWorkspaceChrome && <AgentWorkspaceSidebar bot={agentBot} health={agentHealth} />}
              <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
                {workspaceOutlet}
              </div>
            </div>
          </KbWorkspacePollingProvider>
        ) : (
          workspaceOutlet
        )}
      </div>

      <BotLifecycleModal
        open={lifecycleOpen}
        runKey={lifecycleRunKey}
        action={lifecycleAction}
        botId={agentId}
        onBusyChange={setLifecycleBusy}
        onClose={() => {
          setLifecycleOpen(false);
          setLifecycleAction(null);
        }}
        onSuccess={onLifecycleModalSuccess}
      />

      <Modal
        open={publishRequirementsOpen}
        onClose={() => setPublishRequirementsOpen(false)}
        title="Cannot publish yet"
        description="Complete these requirements first:"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setPublishRequirementsOpen(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-md bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              onClick={() => {
                setPublishRequirementsOpen(false);
                if (agentId) navigate(`/bots/${agentId}/playground/deploy`);
              }}
            >
              Open Deploy & Go Live
            </button>
          </>
        }
      >
        <ul className="m-0 list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
          {(missingPublishChecks.length ? missingPublishChecks : ['Complete the publish requirements in the Deploy & Go Live page.']).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Modal>

      {agentId ? (
        <SharePreviewModal
          open={sharePreviewOpen}
          onClose={() => setSharePreviewOpen(false)}
          botId={agentId}
          bot={agentBot}
          agentStatus={currentStatus}
          onRefresh={refreshAgentFromApi}
          onShareUpdated={onSharePreviewUpdated}
        />
      ) : null}

      <Modal
        open={lifecycleConfirmOpen}
        onClose={cancelLifecycleConfirm}
        tone="default"
        className="max-w-md"
        title={
          lifecycleConfirmAction === 'draft' ? (
            <span className="inline-flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/95 bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04]"
                aria-hidden
              >
                <PencilLine className="h-5 w-5" strokeWidth={2} />
              </span>
              Move to draft
            </span>
          ) : (
            <span className="inline-flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-600 shadow-sm"
                aria-hidden
              >
                <Rocket className="h-5 w-5" strokeWidth={1.75} />
              </span>
              Go live
            </span>
          )
        }
        description={
          lifecycleConfirmAction === 'draft' ? (
            <span>
              On your allowed websites, the embed will stop showing this agent until you publish again. You can go live
              again whenever you are ready.
            </span>
          ) : (
            <span>
              This turns on your chat widget for the allowed websites you configured. You can return to draft anytime.
            </span>
          )
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              onClick={cancelLifecycleConfirm}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(
                'inline-flex h-10 min-w-[8.5rem] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                lifecycleConfirmAction === 'draft'
                  ? 'border border-transparent bg-[var(--color-danger-text-emphasis)] text-white hover:bg-[var(--color-danger-text)] focus-visible:outline-[var(--color-danger-text-emphasis)]'
                  : 'bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600',
              )}
              onClick={confirmLifecycleTransition}
            >
              {lifecycleConfirmAction === 'draft' ? (
                <>
                  <PencilLine size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                  Move to draft
                </>
              ) : (
                <>
                  <Rocket size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                  Go live
                </>
              )}
            </button>
          </>
        }
      >
        <div
          className={
            lifecycleConfirmAction === 'draft'
              ? 'rounded-xl border border-slate-200 bg-slate-100/70 p-3.5 ring-1 ring-slate-900/[0.05]'
              : 'rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 ring-1 ring-slate-900/[0.04]'
          }
        >
          <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">What happens next</p>
          <ul className="mt-2.5 m-0 list-none space-y-2 p-0 text-sm leading-snug text-slate-700">
            {lifecycleConfirmAction === 'draft' ? (
              <>
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.5} aria-hidden />
                  <span>Each allowed website stops showing this agent in the embed until you publish again.</span>
                </li>
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" strokeWidth={2.5} aria-hidden />
                  <span>Your workspace, knowledge, and Deploy & Go Live settings stay as they are.</span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.5} aria-hidden />
                  <span>The install snippet works only on allowed websites you list under Deploy & Go Live.</span>
                </li>
                <li className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.5} aria-hidden />
                  <span>You can copy the snippet anytime and move back to draft from the nav or this page.</span>
                </li>
              </>
            )}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
