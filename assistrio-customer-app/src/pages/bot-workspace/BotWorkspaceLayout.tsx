import { NavLink, Outlet } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import { BotWorkspaceProvider, useBotWorkspace } from './BotWorkspaceContext';
import type { BotWorkspaceLoadState } from './BotWorkspaceContext';
import { TrainingScheduleHelpProvider } from '@/context/TrainingScheduleHelpContext';
import { CustomerWidgetPreviewHost } from './CustomerWidgetPreviewHost';
import { CustomerWidgetPreviewProvider } from './CustomerWidgetPreviewContext';
import { WorkspaceBeforeUnload } from './WorkspaceBeforeUnload';
import { InlineLoader } from '../../components/PageLoader';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

function workspaceFailurePresentation(
  state: Extract<BotWorkspaceLoadState, 'not_found' | 'forbidden' | 'error'>,
  message: string,
): { title: string; description: string; icon: 'not_found' | 'forbidden' | 'network' | 'generic' } {
  const m = (message || '').trim();
  const lower = m.toLowerCase();

  if (state === 'forbidden') {
    return {
      title: "You can't open this assistant",
      description: m || 'Your account does not have access. Ask an admin if you need permission.',
      icon: 'forbidden',
    };
  }

  if (state === 'not_found') {
    return {
      title: 'Assistant not found',
      description: m || 'It may have been deleted or the link is wrong.',
      icon: 'not_found',
    };
  }

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed') ||
    lower === 'fetcherror'
  ) {
    return {
      title: "We couldn't load this assistant",
      description:
        'Your browser could not reach our servers. Check your connection, wait a moment, and try again. VPNs and some corporate networks block requests.',
      icon: 'network',
    };
  }

  return {
    title: 'Something went wrong',
    description: m || 'We could not load this assistant. Please try again.',
    icon: 'generic',
  };
}

function WorkspaceFailureIcon({ kind }: { kind: 'not_found' | 'forbidden' | 'network' | 'generic' }) {
  const common = 'h-7 w-7';
  switch (kind) {
    case 'not_found':
      return <SearchX className={cn(common, 'text-slate-500')} aria-hidden />;
    case 'forbidden':
      return <Lock className={cn(common, 'text-amber-600')} aria-hidden />;
    case 'network':
      return <WifiOff className={cn(common, 'text-slate-500')} aria-hidden />;
    default:
      return <AlertTriangle className={cn(common, 'text-amber-600')} aria-hidden />;
  }
}

function BotWorkspaceShell() {
  const { bot, loadState, loadMessage, botId, reload } = useBotWorkspace();

  const showStaleWorkspaceWhileRefreshing =
    loadState === 'loading' && Boolean(bot && botId && bot.id === botId);

  if (loadState === 'loading' && !showStaleWorkspaceWhileRefreshing) {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <InlineLoader title="Loading assistant…" />
          </div>
        </div>
      </WorkspaceContentContainer>
    );
  }

  if (loadState === 'not_found' || loadState === 'forbidden' || loadState === 'error') {
    const pres = workspaceFailurePresentation(loadState, loadMessage);
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col items-center justify-center p-6">
          <div
            className="w-full max-w-[26rem] rounded-2xl border border-slate-200/90 bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8"
            role="alert"
          >
            <div
              className={cn(
                'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
                pres.icon === 'forbidden' || pres.icon === 'generic'
                  ? 'bg-amber-50 ring-1 ring-amber-100'
                  : 'bg-slate-50 ring-1 ring-slate-100',
              )}
            >
              <WorkspaceFailureIcon kind={pres.icon} />
            </div>
            <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{pres.title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{pres.description}</p>
            {loadState === 'error' &&
            loadMessage.trim() &&
            pres.icon !== 'network' &&
            loadMessage.trim() !== pres.description.trim() ? (
              <p className="mx-auto mt-3 max-w-full rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-snug break-words text-slate-500">
                {loadMessage.trim()}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full min-w-0 sm:w-auto sm:min-w-[9.5rem]"
                onClick={() => void reload()}
              >
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                Try again
              </Button>
              <NavLink
                to="/bots"
                className={cn(
                  'inline-flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-sm font-medium text-slate-800 no-underline transition-colors',
                  'hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/12 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  'sm:w-auto',
                )}
              >
                <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                Back to agents
              </NavLink>
            </div>
          </div>
        </div>
      </WorkspaceContentContainer>
    );
  }

  if (!bot || !botId) return null;

  return (
    <>
      <WorkspaceBeforeUnload />
      {/*
        Single flex child so the active route (Playground w/ fixed height, or Insights full-bleed)
        always gets a consistent min-h-0 flex column — fixes layout when switching e.g. conversations → profile.
      */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      {/* After route tree: playground preview surface lives in `PlaygroundLayout` (stable mount). */}
      <CustomerWidgetPreviewHost />
    </>
  );
}

export function BotWorkspaceLayout() {
  return (
    <BotWorkspaceProvider>
      <TrainingScheduleHelpProvider>
        <CustomerWidgetPreviewProvider>
          <BotWorkspaceShell />
        </CustomerWidgetPreviewProvider>
      </TrainingScheduleHelpProvider>
    </BotWorkspaceProvider>
  );
}
