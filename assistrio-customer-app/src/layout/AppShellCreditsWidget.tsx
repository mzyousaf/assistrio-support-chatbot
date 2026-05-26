import type { MouseEvent, ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { WorkspaceBillingLoadState } from '@/hooks/useWorkspaceBillingSummary';
import { buildAppShellCreditsDisplay } from '@/layout/appShellCreditsDisplay';
import type { WorkspaceBillingAiCreditsUsageSummary } from '@/api/types';
import { cn } from '@/lib/utils';

export type AppShellCreditsWidgetProps = {
  activeWorkspaceId: string | null;
  loadState: WorkspaceBillingLoadState;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  variant: 'peek' | 'card';
  onNavigatePlans?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function CreditsUpgradeLink(props: {
  className?: string;
  onNavigatePlans?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <NavLink
      to="/settings/plans"
      onClick={props.onNavigatePlans}
      className={props.className}
    >
      <Zap size={12} className="shrink-0 fill-white" aria-hidden />
      Upgrade
    </NavLink>
  );
}

function CreditsMeter(props: { percent: number; isOverLimit: boolean }) {
  const barClass = props.isOverLimit
    ? 'bg-gradient-to-r from-red-500 to-red-600'
    : 'bg-gradient-to-r from-teal-400 to-teal-500';

  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={props.percent}
      aria-label="AI credits used this billing period"
    >
      <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${props.percent}%` }} />
    </div>
  );
}

function CreditsBody(props: {
  activeWorkspaceId: string | null;
  loadState: WorkspaceBillingLoadState;
  aiCredits: WorkspaceBillingAiCreditsUsageSummary | undefined;
  footer?: ReactNode;
}) {
  const display = buildAppShellCreditsDisplay(props.aiCredits);

  if (!props.activeWorkspaceId) {
    return (
      <div className="space-y-2">
        <p className="m-0 text-xs text-slate-500">No workspace</p>
        {props.footer}
      </div>
    );
  }

  if (props.loadState === 'loading' && !display) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading credits">
        <p className="m-0 text-xs text-slate-500">Loading…</p>
        <div className="h-1.5 animate-pulse rounded-full bg-slate-100" aria-hidden />
        {props.footer}
      </div>
    );
  }

  if (props.loadState === 'error' || !display) {
    return (
      <div className="space-y-2">
        <p className="m-0 text-xs text-slate-500">Usage unavailable</p>
        {props.footer}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">Credits</span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">
          {display.used.toLocaleString()} / {display.total.toLocaleString()} credits
        </span>
      </div>
      <CreditsMeter percent={display.percent} isOverLimit={display.isOverLimit} />
      <p className="m-0 text-[11px] tabular-nums text-slate-500">
        {display.remaining.toLocaleString()} remaining
      </p>
      {display.isOverLimit ? (
        <p className="m-0 text-[11px] font-medium text-red-700">Over monthly limit</p>
      ) : null}
      {props.footer}
    </div>
  );
}

export function AppShellCreditsWidget(props: AppShellCreditsWidgetProps) {
  if (props.variant === 'peek') {
    if (!props.activeWorkspaceId) return null;

    return (
      <div className="shrink-0 p-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <CreditsBody
          activeWorkspaceId={props.activeWorkspaceId}
          loadState={props.loadState}
          aiCredits={props.aiCredits}
          footer={
            <CreditsUpgradeLink
              onNavigatePlans={props.onNavigatePlans}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]"
            />
          }
        />
      </div>
    );
  }

  if (!props.activeWorkspaceId) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-xl shadow-[var(--shadow-card)]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)' }}>
      <div className="p-3">
        <CreditsBody activeWorkspaceId={props.activeWorkspaceId} loadState={props.loadState} aiCredits={props.aiCredits} />
      </div>
      <div className="p-3" style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-sidebar-secondary)' }}>
        <div className="mb-1.5 flex items-center gap-2">
          <Zap size={13} className="shrink-0 fill-amber-400 text-amber-400" aria-hidden />
          <span className="text-xs font-semibold text-slate-700">Upgrade to Pro</span>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          Get more AI credits, remove branding &amp; priority support.
        </p>
        <CreditsUpgradeLink
          onNavigatePlans={props.onNavigatePlans}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-sm transition-all duration-150 hover:bg-teal-700 active:scale-[0.98]"
        />
      </div>
    </div>
  );
}
