import type { ReactNode } from 'react';
import { BriefcaseBusiness } from 'lucide-react';
import { getSupportUrl } from '@/lib/supportUrl';
import { cn } from '@/lib/utils';

type ShellProps = {
  children: ReactNode;
  className?: string;
  /** Center card content (status pages). Details pages can stay left-aligned inside. */
  centered?: boolean;
};

export function InviteAcceptShell({ children, className, centered = true }: ShellProps) {
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-[#f8fafc]">
      <div className="relative flex min-h-svh flex-col">
        <header className="relative z-10 shrink-0 bg-[#f8fafc] px-4 pt-4 pb-1 sm:px-6 sm:pt-4">
          <div className="mx-auto flex w-full max-w-[560px] items-center justify-center">
            <div className="inline-flex items-center gap-2">
              <img
                src="/logo-mark.png"
                alt=""
                width={28}
                height={28}
                className="block h-7 w-7 shrink-0 object-contain"
                decoding="async"
              />
              <img
                src="/logo-text.png"
                alt="Assistrio"
                width={180}
                height={24}
                className="block h-[1.5rem] w-auto max-w-[180px] object-contain"
                decoding="async"
              />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-4 pt-4 sm:px-6 sm:pt-6">
          <div className={cn('w-full max-w-[560px]', className)}>
            <div
              className={cn(
                'rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_rgba(15,23,42,0.07)] sm:p-9',
                centered && 'text-center',
              )}
            >
              {children}
            </div>
          </div>
        </div>

        <footer className="relative z-10 shrink-0 bg-[#f8fafc] px-4 pb-6 pt-2 text-center sm:px-6">
          <p className="text-xs leading-relaxed text-slate-400">
            &copy; {year} Assistrio. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}

export type InviteStatusTone = 'neutral' | 'warning' | 'success' | 'teal';

const STATUS_ICON_BG: Record<InviteStatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  success: 'bg-teal-50 text-teal-700 ring-1 ring-teal-100',
  teal: 'bg-teal-50 text-teal-700 ring-1 ring-teal-100',
};

export function InviteStatusIcon({
  tone,
  children,
  className,
}: {
  tone: InviteStatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full',
        STATUS_ICON_BG[tone],
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  );
}

export function InviteWorkspaceBadge() {
  return (
    <div className="mb-4 flex justify-center">
      <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-teal-700 ring-1 ring-teal-100/80">
        Workspace invite
      </span>
    </div>
  );
}

export function InviteValidHeading({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-center text-[1.5rem] font-semibold tracking-tight text-slate-900 sm:text-[1.625rem]">
      {children}
    </h1>
  );
}

export function InviteWorkspaceSummary({
  workspaceName,
  roleLabel,
  invitedBy,
  expiresAt,
}: {
  workspaceName: string;
  roleLabel: string;
  invitedBy: string;
  expiresAt: string;
}) {
  const rows = [
    { label: 'Role', value: roleLabel },
    { label: 'Invited by', value: invitedBy },
    { label: 'Expires', value: expiresAt },
  ];

  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-4 py-3.5 text-left">
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/70"
          aria-hidden
        >
          <BriefcaseBusiness className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-sm font-semibold text-slate-900">{workspaceName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{roleLabel} access invitation</p>
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-6 text-sm">
            <dt className="shrink-0 text-slate-500">{row.label}</dt>
            <dd className="min-w-0 text-right font-medium text-slate-800">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function InviteCtaBlock({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-sm', className)}>{children}</div>;
}

export function InviteSupportLink({ className }: { className?: string }) {
  const supportUrl = getSupportUrl();
  if (!supportUrl) return null;

  return (
    <p className={cn('text-sm text-slate-500', className)}>
      Need help?{' '}
      <a
        href={supportUrl}
        className="font-medium text-teal-700 no-underline hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Contact support
      </a>
    </p>
  );
}

type StatusPanelProps = {
  icon: ReactNode;
  tone: InviteStatusTone;
  title: string;
  body: string;
  secondaryBody?: string;
  actions: ReactNode;
  showSupport?: boolean;
};

export function InviteStatusPanel({
  icon,
  tone,
  title,
  body,
  secondaryBody,
  actions,
  showSupport = true,
}: StatusPanelProps) {
  return (
    <div role="alert">
      <InviteStatusIcon tone={tone}>{icon}</InviteStatusIcon>
      <h1 className="text-[1.625rem] font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mx-auto mt-3 max-w-[24rem] text-[0.9375rem] leading-relaxed text-slate-600">{body}</p>
      {secondaryBody ? (
        <p className="mx-auto mt-2 max-w-[24rem] text-sm leading-relaxed text-slate-500">{secondaryBody}</p>
      ) : null}
      <div className="mt-8">{actions}</div>
      {showSupport ? <InviteSupportLink className="mt-5" /> : null}
    </div>
  );
}

export function InvitePrimaryActions({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-sm flex-col gap-3">{children}</div>;
}
