import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardBody } from '@/components/ui/Card';
import { customYmdRangeIsValid } from '@/lib/analyticsQueryDates';
import { formatAnalyticsInteger } from '@/lib/analyticsFormat';
import { cn } from '@/lib/utils';
import type { AdminPlatformAnalyticsDateState } from './adminPlatformAnalyticsDate';

const PRESET_OPTIONS: { value: AdminPlatformAnalyticsDateState['preset']; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

type DateRangeProps = {
  value: AdminPlatformAnalyticsDateState;
  onChange: (next: AdminPlatformAnalyticsDateState) => void;
  rangeLabel?: string | null;
};

export function AdminAnalyticsDateRangeControl({ value, onChange, rangeLabel }: DateRangeProps) {
  const customInvalid =
    value.preset === 'custom' &&
    value.customFrom.trim() &&
    value.customTo.trim() &&
    !customYmdRangeIsValid(value.customFrom, value.customTo);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[10rem]">
        <label className="mb-1 block text-[0.75rem] font-medium text-slate-600" htmlFor="admin-analytics-preset">
          Date range
        </label>
        <Select
          id="admin-analytics-preset"
          value={value.preset}
          onChange={(e) => onChange({ ...value, preset: e.target.value as AdminPlatformAnalyticsDateState['preset'] })}
          triggerClassName="h-9 w-full min-w-[10rem]"
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      {value.preset === 'custom' ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[0.75rem] font-medium text-slate-600" htmlFor="admin-analytics-from">
              From
            </label>
            <Input
              id="admin-analytics-from"
              type="date"
              value={value.customFrom}
              onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
              className="h-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.75rem] font-medium text-slate-600" htmlFor="admin-analytics-to">
              To
            </label>
            <Input
              id="admin-analytics-to"
              type="date"
              value={value.customTo}
              onChange={(e) => onChange({ ...value, customTo: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
      ) : null}
      {rangeLabel ? (
        <p className="text-[0.8125rem] text-slate-500 sm:ml-auto sm:self-center">{rangeLabel}</p>
      ) : null}
      {customInvalid ? (
        <p className="w-full text-[0.8125rem] text-amber-700" role="status">
          Invalid custom range — using last 30 days until dates are valid.
        </p>
      ) : null}
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: unknown;
  /** When set, shown instead of integer formatting (e.g. formatted dates). */
  displayValue?: string;
  hint?: string;
};

export function AdminAnalyticsMetricCard({ label, value, hint, displayValue }: MetricCardProps) {
  const shown = displayValue ?? formatAnalyticsInteger(value);
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardBody className="py-4">
        <p className="m-0 text-[0.75rem] font-medium text-slate-500">{label}</p>
        <p className="m-0 mt-1 text-[1.5rem] font-semibold tabular-nums tracking-tight text-slate-900">
          {shown}
        </p>
        {hint ? <p className="m-0 mt-1 text-[0.6875rem] leading-snug text-slate-400">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

export function AdminAnalyticsCaveats({ items }: { items: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <details className="rounded-[0.625rem] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-[0.8125rem] text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">How these numbers are counted</summary>
      <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
        {items.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </details>
  );
}

export function AdminAnalyticsLoading({ label = 'Loading analytics…' }: { label?: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}

export function AdminAnalyticsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-[0.625rem] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-[0.85rem] text-[0.875rem] text-[var(--color-danger-text-emphasis)]"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="m-0">{message}</p>
          {onRetry ? (
            <button
              type="button"
              className="mt-2 cursor-pointer text-[0.8125rem] font-semibold text-[var(--color-danger-text-emphasis)] underline"
              onClick={onRetry}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AdminAnalyticsEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]"
      style={{ border: '1px dashed var(--border-soft)' }}
    >
      <div className="mb-4 flex justify-center text-slate-300">
        <BarChart3 size={44} strokeWidth={1.5} aria-hidden />
      </div>
      <h2 className="mb-2 mt-0 text-[1.125rem] font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mx-auto m-0 max-w-[28rem] text-[0.9375rem] leading-[1.55] text-slate-400">{description}</p>
    </div>
  );
}

export function AdminAnalyticsTableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ui-border)] bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-[0.8125rem]">{children}</table>
    </div>
  );
}

export function AdminAnalyticsTh({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-slate-100 bg-slate-50/90 px-4 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function AdminAnalyticsTd({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('border-b border-slate-50 px-4 py-3 align-middle text-slate-800', className)}>{children}</td>;
}

export function PlatformBotTypeBadge({
  isPlatformBot,
  platformBotType,
  agentsPackAgent,
}: {
  isPlatformBot?: boolean;
  platformBotType?: string | null;
  agentsPackAgent?: boolean;
}) {
  if (!isPlatformBot && !agentsPackAgent) return null;
  const label = platformBotType
    ? platformBotType.replace(/_/g, ' ')
    : agentsPackAgent
      ? 'Platform pack'
      : 'Platform';
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[0.6875rem] font-semibold capitalize text-violet-800">
      {label}
    </span>
  );
}

export function AdminBotAnalyticsLinks({
  botId,
  compact,
  showAnalyticsLink = true,
}: {
  botId: string;
  compact?: boolean;
  showAnalyticsLink?: boolean;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', compact ? 'text-[0.75rem]' : 'text-[0.8125rem]')}>
      <Link
        to={`/bots/${botId}`}
        className="font-medium text-[var(--color-teal-700)] hover:text-[var(--color-teal-800)] hover:underline"
      >
        Open bot
      </Link>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <Link
        to={`/bots/${botId}/conversations`}
        className="font-medium text-[var(--color-teal-700)] hover:text-[var(--color-teal-800)] hover:underline"
      >
        Conversations
      </Link>
      {showAnalyticsLink ? (
        <>
          <span className="text-slate-300" aria-hidden>
            ·
          </span>
          <Link
            to={`/bots/${botId}/analytics`}
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Bot analytics
          </Link>
        </>
      ) : null}
    </div>
  );
}
