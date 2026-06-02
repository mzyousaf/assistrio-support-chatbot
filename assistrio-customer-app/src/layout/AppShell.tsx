import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type MutableRefObject, type RefObject } from 'react';
import {
  Database,
  CheckCircle2,
  ChevronDown,
  Copy,
  CreditCard,
  Gauge,
  Globe2,
  HelpCircle,
  Info,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  PencilLine,
  Rocket,
  Settings,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PostGoLiveInstallModalHost } from '@/components/onboarding/PostGoLiveInstallModalHost';
import { getCustomerBot } from '../api/customerApi';
import { getCustomerApiOrigin } from '../api/client';
import type { CustomerBotDetail, CustomerBotLifecycleResponse, CustomerMe, CustomerShareLinkResponse } from '../api/types';
import { AgentWorkspaceSidebar } from '../pages/bot-workspace/AgentWorkspaceSidebar';
import { SharePreviewModal } from '../pages/bot-workspace/SharePreviewModal';
import { workspaceSharePreviewAllowed } from '@/lib/planEntitlements';
import { useWorkspaceDiscardModal } from '../pages/bot-workspace/WorkspaceDiscardModal';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCustomerLogout } from '../auth/useCustomerLogout';
import { customerInitials } from '../lib/customerDisplay';
import { widgetSnippet } from '../lib/embedOrigin';
import { BotLifecycleModal } from '../components/BotLifecycleModal';
import { GoLiveConfirmModal } from '@/components/go-live/GoLiveConfirmModal';
import {
  WORKSPACE_DRAFT_WHAT_HAPPENS_NEXT,
  WORKSPACE_PUBLISH_WHAT_HAPPENS_NEXT,
} from '@/components/go-live/goLiveConfirmCopy';
import { BotLifecycleProvider } from '../context/BotLifecycleContext';
import { KbWorkspacePollingProvider } from '../context/KbWorkspacePollingContext';
import { Modal } from '../components/ui/Modal';
import { ASSISTRIO_NAVBAR_BOT_REFRESH, requestWorkspaceBotRefresh } from '../lib/botSyncEvents';
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher';
import { canManageActiveWorkspace } from '@/lib/canManageActiveWorkspace';
import { resolveActiveCustomerWorkspace } from '@/lib/resolveActiveCustomerWorkspace';
import {
  buildWorkspaceBillingSessionKey,
  useWorkspaceBillingSummary,
} from '@/hooks/useWorkspaceBillingSummary';
import { AppShellCreditsWidget } from '@/layout/AppShellCreditsWidget';
import { AccountSettingsModal } from '@/components/account/AccountSettingsModal';

import { resolveSettingsNavActiveIndex, SETTINGS_NAV_ITEMS } from '@/lib/settingsNavigation';

import { cn } from '@/lib/utils';

// TODO(epic-4): Filter bot list by active workspace when backend supports workspace-scoped bot listing.

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
  canManageLifecycle = true,
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
  canManageLifecycle?: boolean;
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
        {canManageLifecycle ? (
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
        ) : (
          <span className="inline-flex h-6 items-center justify-self-end text-xs font-semibold text-slate-700">
            {currentStatus === 'published' ? 'Live' : 'Draft'}
          </span>
        )}
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
  const [lifecycleOptimisticStatus, setLifecycleOptimisticStatus] = useState<'draft' | 'published' | null>(null);
  const [lifecycleRunKey, setLifecycleRunKey] = useState(0);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const statusToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [publishRequirementsOpen, setPublishRequirementsOpen] = useState(false);
  const [lifecycleConfirmOpen, setLifecycleConfirmOpen] = useState(false);
  const [lifecycleConfirmAction, setLifecycleConfirmAction] = useState<'publish' | 'draft' | null>(null);
  const deployPublishReadyRef = useRef<boolean | null>(null);
  const [agentInfoExpanded, setAgentInfoExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const sidebarHoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    location.pathname.startsWith('/settings'),
  );
  const [sharePreviewOpen, setSharePreviewOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);

  const sidebarPeeking = sidebarCollapsed && sidebarHovered;

  const { customer, needsOnboarding, activateWorkspace } = useCustomerAuth();
  const { activeWorkspaceId } = resolveActiveCustomerWorkspace(customer);
  const billingSessionKey = useMemo(
    () =>
      buildWorkspaceBillingSessionKey({
        customerId: customer?.id,
        activeWorkspaceId,
        workspaceIds: customer?.workspaceIds,
      }),
    [customer?.id, customer?.workspaceIds, activeWorkspaceId],
  );
  const { summary: billingSummary, loadState: billingLoadState } = useWorkspaceBillingSummary(
    activeWorkspaceId,
    billingSessionKey,
  );
  const activeBillingSummary =
    billingSummary?.workspaceId === activeWorkspaceId ? billingSummary : null;
  const sidebarAiCredits = activeBillingSummary?.usage?.aiCredits;
  const { signOut, logoutInFlight, logoutError, clearLogoutError } = useCustomerLogout();

  const initials = customer ? customerInitials(customer) : '?';
  const picture = customer?.picture?.trim();
  const profileName = useMemo(() => accountDisplayName(customer), [customer]);
  const profileEmail = customer?.email?.trim() ?? '';
  const canManageWorkspaceBot = canManageActiveWorkspace(customer);
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
  const effectiveAgentStatus = lifecycleOptimisticStatus ?? currentStatus;

  useEffect(() => {
    if (!lifecycleOptimisticStatus) return;
    if (currentStatus === lifecycleOptimisticStatus) {
      setLifecycleOptimisticStatus(null);
    }
  }, [currentStatus, lifecycleOptimisticStatus]);
  const visibilityLabel = String(agentBot?.visibility ?? '').toLowerCase() === 'private' ? 'Private' : 'Public';
  const canPublishFromNavbar = Boolean(
    String(agentBot?.name ?? '').trim() &&
      String(agentBot?.description ?? '').trim() &&
      (agentBot?.allowedOrigins ?? []).some((o) => o?.isActive !== false && String(o?.origin ?? '').trim()),
  );
  const resolveCanPublish = useCallback(() => {
    const deployReady = deployPublishReadyRef.current;
    if (deployReady != null) return deployReady;
    return canPublishFromNavbar;
  }, [canPublishFromNavbar]);
  const setDeployPublishReady = useCallback((ready: boolean | null) => {
    deployPublishReadyRef.current = ready;
  }, []);
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
  const showCreditsInPrimarySidebar = !isAgentWorkspace || hideAgentWorkspaceChrome;
  /** Playground uses `WidgetPreviewContainer` with its own scroll lane — avoid nested page scrollbars. */
  const playgroundScrollContained = Boolean(agentId && /\/playground\//.test(location.pathname));
  const workspaceScrollContained = playgroundScrollContained || hideAgentWorkspaceChrome;

  const settingsSubNav: [string, string][] = SETTINGS_NAV_ITEMS.map((item) => [item.to, item.label]);
  const settingsSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const settingsTrackRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null);

  const peekSubNavRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const peekTrackRef = useRef<HTMLDivElement>(null);
  const [peekIndicator, setPeekIndicator] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const activeIdx = resolveSettingsNavActiveIndex(location.pathname);

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

  const onLifecycleApiSuccess = useCallback(
    (data: CustomerBotLifecycleResponse) => {
      if (!agentId) return;
      const nextStatus = data.action === 'publish' ? 'published' : 'draft';
      setLifecycleOptimisticStatus(nextStatus);
      requestWorkspaceBotRefresh(agentId);
    },
    [agentId],
  );

  const onLifecycleModalSuccess = useCallback(() => {
    if (!agentId) return;
    void (async () => {
      await refreshAgentFromApi();
      requestWorkspaceBotRefresh(agentId);
    })();
  }, [agentId, refreshAgentFromApi]);

  const lifecycleUiBusy = Boolean(lifecycleOpen && lifecycleAction);

  const openPublishLifecycle = useCallback(() => {
    if (!agentId || effectiveAgentStatus === 'published' || lifecycleUiBusy) return;
    if (!resolveCanPublish()) {
      setPublishRequirementsOpen(true);
      return;
    }
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    setLifecycleConfirmAction('publish');
    setLifecycleConfirmOpen(true);
  }, [agentId, effectiveAgentStatus, lifecycleUiBusy, resolveCanPublish]);

  const openDraftLifecycle = useCallback(() => {
    if (!agentId || effectiveAgentStatus === 'draft' || lifecycleUiBusy) return;
    agentInfoDetailsRef.current?.removeAttribute('open');
    setAgentInfoExpanded(false);
    setLifecycleConfirmAction('draft');
    setLifecycleConfirmOpen(true);
  }, [agentId, effectiveAgentStatus, lifecycleUiBusy]);

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
    if (!agentId || lifecycleUiBusy) return;
    if (act === 'publish') {
      if (effectiveAgentStatus === 'published') return;
      if (!resolveCanPublish()) {
        setPublishRequirementsOpen(true);
        return;
      }
      setLifecycleAction('publish');
      setLifecycleRunKey((k) => k + 1);
      setLifecycleOpen(true);
    } else if (act === 'draft') {
      if (effectiveAgentStatus === 'draft') return;
      setLifecycleAction('draft');
      setLifecycleRunKey((k) => k + 1);
      setLifecycleOpen(true);
    }
  }, [
    lifecycleConfirmAction,
    agentId,
    lifecycleUiBusy,
    effectiveAgentStatus,
    resolveCanPublish,
  ]);

  const lifecycleControls = useMemo(
    () => ({
      openPublish: openPublishLifecycle,
      openDraft: openDraftLifecycle,
      busy: lifecycleUiBusy,
      action: lifecycleAction,
      optimisticStatus: lifecycleOptimisticStatus,
      setDeployPublishReady,
    }),
    [
      openPublishLifecycle,
      openDraftLifecycle,
      lifecycleUiBusy,
      lifecycleAction,
      lifecycleOptimisticStatus,
      setDeployPublishReady,
    ],
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

  const toggleWorkspaceSettings = useCallback(() => {
    clearTimeout(sidebarHoverTimer.current);
    setSettingsOpen((open) => {
      const next = !open;
      if (next && sidebarCollapsed) setSidebarHovered(true);
      return next;
    });
  }, [sidebarCollapsed]);

  const renderWorkspaceSettingsNav = ({
    trackRef,
    subNavRefs,
    activeIndicator,
    wrapperClassName,
    subNavClassName,
  }: {
    trackRef: RefObject<HTMLDivElement | null>;
    subNavRefs: MutableRefObject<(HTMLAnchorElement | null)[]>;
    activeIndicator: { top: number; height: number } | null;
    wrapperClassName?: string;
    subNavClassName?: string;
  }) => (
    <div className={wrapperClassName}>
      <button
        type="button"
        className={cn(
          'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm font-medium cursor-pointer border-none bg-transparent text-left',
          'transition-[background-color,color] duration-150 ease-out',
          isSettingsActive
            ? 'font-semibold text-[var(--active-text)]'
            : 'text-slate-500 nav-hover',
        )}
        aria-expanded={settingsOpen}
        onClick={toggleWorkspaceSettings}
      >
        <Settings
          size={18}
          strokeWidth={1.75}
          className={cn(
            'shrink-0 transition-colors duration-150',
            isSettingsActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600',
          )}
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
      {settingsOpen ? (
        <div ref={trackRef} className={subNavClassName}>
          <div
            className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full max-[900px]:hidden"
            style={{ background: 'var(--border-soft)' }}
            aria-hidden
          />
          {activeIndicator ? (
            <div
              className="absolute left-0 w-[2px] rounded-full bg-teal-500 max-[900px]:hidden"
              style={{
                top: activeIndicator.top,
                height: activeIndicator.height,
                transition: 'top 250ms cubic-bezier(0.4,0,0.2,1), height 250ms cubic-bezier(0.4,0,0.2,1)',
              }}
              aria-hidden
            />
          ) : null}
          {settingsSubNav.map(([to, label], i) => (
            <NavLink
              key={to}
              to={to}
              className={sideSubNavLink}
              onClick={(e) => workspaceLeaveGuard(e, to)}
              ref={(el) => {
                subNavRefs.current[i] = el;
              }}
            >
              {label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );

  const workspaceOutlet = useMemo(
    () => (
      <main
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-x-visible',
          workspaceScrollContained &&
            'h-full min-h-0 flex-1 overflow-y-hidden',
        )}
        style={{ background: 'var(--bg-workspace-canvas)' }}
      >
        <BotLifecycleProvider value={lifecycleControls}>
          <Outlet />
        </BotLifecycleProvider>
      </main>
    ),
    [workspaceScrollContained, lifecycleControls],
  );

  return (
    <div
      className="flex h-svh min-h-0 flex-col overflow-hidden text-slate-900"
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
            <WorkspaceSwitcher
              ref={workspaceDetailsRef}
              customer={customer}
              activateWorkspace={activateWorkspace}
              navigate={navigate}
            />

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
                      canManageLifecycle={canManageWorkspaceBot}
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
                {canManageWorkspaceBot ? (
                <div
                  className="inline-flex h-8 min-w-[9.5rem] items-center rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                  role="radiogroup"
                  aria-label="Agent status"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={effectiveAgentStatus === 'draft'}
                    className={cn(
                      'inline-flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-[background-color,color] duration-150',
                      effectiveAgentStatus === 'draft'
                        ? 'bg-slate-100 text-slate-800'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                      (lifecycleBusy || effectiveAgentStatus === 'draft') && 'cursor-default',
                    )}
                    onClick={openDraftLifecycle}
                    disabled={lifecycleUiBusy || effectiveAgentStatus === 'draft'}
                    title={effectiveAgentStatus === 'draft' ? 'Agent currently in draft' : 'Move agent to draft'}
                  >
                    <PencilLine size={12} strokeWidth={2} className="mr-1 shrink-0" aria-hidden />
                    {lifecycleUiBusy && lifecycleAction === 'draft' && !lifecycleOptimisticStatus ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        Moving to draft
                      </span>
                    ) : (
                      'Draft'
                    )}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={effectiveAgentStatus === 'published'}
                    className={cn(
                      'inline-flex h-7 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2.5 text-xs font-semibold transition-[background-color,color] duration-150',
                      effectiveAgentStatus === 'published'
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                      (lifecycleUiBusy || effectiveAgentStatus === 'published') && 'cursor-default',
                    )}
                    onClick={openPublishLifecycle}
                    disabled={lifecycleUiBusy || effectiveAgentStatus === 'published'}
                    title={
                      effectiveAgentStatus === 'published'
                        ? 'Agent is live'
                        : canPublishFromNavbar
                          ? 'Go live with this agent'
                          : 'Go live — complete requirements first if prompted'
                    }
                  >
                    {lifecycleUiBusy && lifecycleAction === 'publish' && !lifecycleOptimisticStatus ? (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 shrink-0 animate-spin" aria-hidden />
                        Going Live
                      </>
                    ) : (
                      <>
                        <Rocket size={12} strokeWidth={2} className="mr-1 shrink-0" aria-hidden />
                        Go Live
                      </>
                    )}
                  </button>
                </div>
                ) : null}
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
                  <NavLink
                    to="/bots"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 no-underline transition-colors duration-150 nav-hover"
                    role="menuitem"
                    onClick={closeAllMenus}
                  >
                    <LayoutDashboard size={15} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                    Dashboard
                  </NavLink>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-none bg-transparent px-2.5 py-1.5 text-left font-[inherit] text-sm font-medium text-slate-500 transition-colors duration-150 nav-hover"
                    role="menuitem"
                    onClick={() => {
                      closeAllMenus();
                      setAccountSettingsOpen(true);
                    }}
                  >
                    <UserCog size={15} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                    Account settings
                  </button>
                  <NavLink
                    to="/settings/billing"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 no-underline transition-colors duration-150 nav-hover"
                    role="menuitem"
                    onClick={closeAllMenus}
                  >
                    <CreditCard size={15} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
                    Billing & plans
                  </NavLink>
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
        className="flex min-h-0 flex-1 overflow-hidden max-[900px]:flex-col max-[900px]:overflow-y-auto"
        style={{ background: 'var(--bg-workspace-canvas)' }}
      >
        {/* Sidebar */}
        <aside
          className={cn(
            'relative flex min-h-0 shrink-0 flex-col bg-white transition-[width] duration-200 ease-out max-[900px]:w-full max-[900px]:border-b',
            sidebarCollapsed ? 'overflow-visible' : 'overflow-hidden',
            sidebarPeeking && 'z-40',
            hideAgentWorkspaceChrome && 'hidden',
          )}
          style={{ borderRight: '1px solid var(--border-sidebar)', width: sidebarCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }}
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
                  'absolute inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-white',
                  'transition-[width,box-shadow] duration-250 ease-[cubic-bezier(0.25,0.1,0.25,1)]',
                  sidebarPeeking
                    ? 'w-[var(--sidebar-width)] shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)]'
                    : 'pointer-events-none w-0',
                )}
                style={{ borderRight: '1px solid var(--border-sidebar)' }}
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

                  {renderWorkspaceSettingsNav({
                    trackRef: peekTrackRef,
                    subNavRefs: peekSubNavRefs,
                    activeIndicator: peekIndicator,
                    subNavClassName: 'relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3',
                  })}
                </div>

                {showCreditsInPrimarySidebar ? (
                  <AppShellCreditsWidget
                    variant="peek"
                    activeWorkspaceId={activeWorkspaceId}
                    loadState={billingLoadState}
                    aiCredits={sidebarAiCredits}
                    topUps={activeBillingSummary?.topUps}
                    billingSummary={activeBillingSummary}
                    onNavigatePlans={(e) => workspaceLeaveGuard(e, '/settings/billing')}
                  />
                ) : null}
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
                <button
                  type="button"
                  className={cn(
                    'group relative flex items-center justify-center rounded-md p-2 text-sm font-medium cursor-pointer border-none bg-transparent',
                    'transition-[background-color,color,box-shadow] duration-150 ease-out',
                    isSettingsActive
                      ? 'nav-active font-semibold'
                      : 'text-slate-500 nav-hover',
                  )}
                  title="Workspace Settings"
                  aria-expanded={settingsOpen}
                  onClick={toggleWorkspaceSettings}
                >
                  <Settings
                    size={18}
                    strokeWidth={1.75}
                    className={cn(
                      'shrink-0 transition-colors duration-150',
                      isSettingsActive ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-600',
                    )}
                    aria-hidden
                  />
                </button>
              </div>
            ) : (
              renderWorkspaceSettingsNav({
                trackRef: settingsTrackRef,
                subNavRefs: settingsSubNavRefs,
                activeIndicator: indicator,
                wrapperClassName: 'max-[900px]:flex max-[900px]:flex-wrap max-[900px]:gap-0.5',
                subNavClassName: 'relative ml-4 mt-1 flex flex-col gap-1 pb-1 pl-3 max-[900px]:ml-0',
              })
            )}
          </nav>

          {/* ── Sidebar bottom ── */}
          <div className="shrink-0 max-[900px]:hidden">
            {!sidebarCollapsed && showCreditsInPrimarySidebar ? (
              <div className="px-3 pb-2">
                <AppShellCreditsWidget
                  variant="card"
                  collapseContext="primary"
                  activeWorkspaceId={activeWorkspaceId}
                  loadState={billingLoadState}
                  aiCredits={sidebarAiCredits}
                  topUps={activeBillingSummary?.topUps}
                  billingSummary={activeBillingSummary}
                  onNavigatePlans={(e) => workspaceLeaveGuard(e, '/settings/billing')}
                />
              </div>
            ) : null}

          </div>
        </aside>

        {/* Sidebar collapse/expand handle — hidden when agent detail is open */}
        {!agentId && !hideAgentWorkspaceChrome && (
          <button
            type="button"
            className="group relative z-10 flex w-3 shrink-0 cursor-pointer items-center justify-center border-none p-0 max-[900px]:hidden"
            style={{ background: 'var(--bg-workspace-canvas)' }}
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
            <div className="relative z-0 flex h-full min-h-0 min-w-0 flex-1 flex-row overflow-hidden max-[900px]:flex-col">
              {!hideAgentWorkspaceChrome && (
                <AgentWorkspaceSidebar
                  bot={agentBot}
                  health={agentHealth}
                  creditsWidget={
                    <AppShellCreditsWidget
                      variant="card"
                      collapseContext="agent"
                      activeWorkspaceId={activeWorkspaceId}
                      loadState={billingLoadState}
                      aiCredits={sidebarAiCredits}
                      topUps={activeBillingSummary?.topUps}
                      billingSummary={activeBillingSummary}
                      onNavigatePlans={(e) => workspaceLeaveGuard(e, '/settings/billing')}
                    />
                  }
                />
              )}
              <div
                className={cn(
                  'relative flex min-h-0 min-w-0 flex-1 flex-col',
                  workspaceScrollContained
                    ? 'h-full overflow-y-hidden'
                    : 'overflow-y-auto overscroll-y-contain',
                )}
              >
                {workspaceOutlet}
              </div>
            </div>
          </KbWorkspacePollingProvider>
        ) : (
          <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
            {workspaceOutlet}
          </div>
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
          setLifecycleBusy(false);
        }}
        onApiSuccess={onLifecycleApiSuccess}
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
          sharePreviewAllowed={workspaceSharePreviewAllowed(activeBillingSummary?.entitlements)}
          onRefresh={refreshAgentFromApi}
          onShareUpdated={onSharePreviewUpdated}
        />
      ) : null}

      <GoLiveConfirmModal
        open={lifecycleConfirmOpen && lifecycleConfirmAction != null}
        onClose={cancelLifecycleConfirm}
        onConfirm={confirmLifecycleTransition}
        action={lifecycleConfirmAction ?? 'publish'}
        whatHappensNext={
          lifecycleConfirmAction === 'draft'
            ? WORKSPACE_DRAFT_WHAT_HAPPENS_NEXT
            : WORKSPACE_PUBLISH_WHAT_HAPPENS_NEXT
        }
      />

      <PostGoLiveInstallModalHost />

      <AccountSettingsModal open={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />
    </div>
  );
}
