import { NavLink } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Lock, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

export type WorkspaceLoadFailureIconKind = 'not_found' | 'forbidden' | 'network' | 'generic';

type Props = {
  icon: WorkspaceLoadFailureIconKind;
  title: string;
  description: string;
  /** Optional monospace detail (e.g. raw API error). Hidden when equal to `description`. */
  detail?: string | null;
  /** When true, do not show `detail` even if set (workspace hides detail for network errors). */
  hideDetail?: boolean;
  onPrimary: () => void;
  primaryLabel?: string;
  /**
   * `undefined` = default “Back to bots”.
   * Pass `null` for iframe/embed flows where in-app navigation does not apply.
   */
  secondary?: { to: string; label: string } | null;
};

export function WorkspaceLoadFailureIcon({ kind }: { kind: WorkspaceLoadFailureIconKind }) {
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

/**
 * Shared full-width error card used when an assistant/workspace fails to load,
 * when the iframe chat bootstrap fails, and (mirrored in `@assistrio/chat-widget`) on embed init failure.
 */
export function WorkspaceLoadFailureCard({
  icon,
  title,
  description,
  detail,
  hideDetail,
  onPrimary,
  primaryLabel = 'Try again',
  secondary,
}: Props) {
  const d = (detail ?? '').trim();
  const desc = (description ?? '').trim();
  const showDetail = Boolean(d && !hideDetail && d !== desc);
  const resolvedSecondary = secondary === undefined ? { to: '/bots', label: 'Back to bots' } : secondary;

  return (
    <div
      className="w-full max-w-[26rem] rounded-2xl border border-slate-200/90 bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-8"
      role="alert"
    >
      <div
        className={cn(
          'mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full',
          icon === 'forbidden' || icon === 'generic'
            ? 'bg-amber-50 ring-1 ring-amber-100'
            : 'bg-slate-50 ring-1 ring-slate-100',
        )}
      >
        <WorkspaceLoadFailureIcon kind={icon} />
      </div>
      <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{desc}</p>
      {showDetail ? (
        <p className="mx-auto mt-3 max-w-full rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-snug break-words text-slate-500">
          {d}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full min-w-0 sm:w-auto sm:min-w-[9.5rem]"
          onClick={onPrimary}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          {primaryLabel}
        </Button>
        {resolvedSecondary ? (
          <NavLink
            to={resolvedSecondary.to}
            className={cn(
              'inline-flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 text-sm font-medium text-slate-800 no-underline transition-colors',
              'hover:border-[var(--ui-border-hover)] hover:bg-[var(--ui-surface-muted)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/12 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              'sm:w-auto',
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
            {resolvedSecondary.label}
          </NavLink>
        ) : null}
      </div>
    </div>
  );
}
