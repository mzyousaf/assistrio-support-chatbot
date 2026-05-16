import type { CustomerKnowledgeUsage } from '@/api/types';
import { cn } from '@/lib/utils';
import {
  KB_STORAGE_USAGE_CRITICAL_PERCENT,
  KB_STORAGE_USAGE_WARN_PERCENT,
} from '@/lib/knowledgeStorageLimits';

export function clampKnowledgeUsagePercent(usage: CustomerKnowledgeUsage): number {
  const p = usage.percentUsed;
  const raw = Number.isFinite(p)
    ? p
    : (() => {
        const max = usage.maxBytes;
        if (!Number.isFinite(max) || max <= 0) return 0;
        return (usage.totalBytes / max) * 100;
      })();
  return Math.min(100, Math.max(0, raw));
}

export function usageTierBadgeClasses(pct: number): string {
  const p = Math.min(100, Math.max(0, pct));
  if (p >= KB_STORAGE_USAGE_CRITICAL_PERCENT) {
    return 'bg-red-50 text-red-950 ring-red-600/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]';
  }
  if (p >= KB_STORAGE_USAGE_WARN_PERCENT) {
    return 'bg-amber-50 text-amber-950 ring-amber-600/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]';
  }
  return 'bg-emerald-50 text-emerald-950 ring-emerald-600/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]';
}

/** Solid meter fill — tiers {@link KB_STORAGE_USAGE_WARN_PERCENT}% / {@link KB_STORAGE_USAGE_CRITICAL_PERCENT}% used. */
export function usageTierMeterFillClass(pct: number): string {
  const p = Math.min(100, Math.max(0, pct));
  if (p >= KB_STORAGE_USAGE_CRITICAL_PERCENT) return 'bg-red-500';
  if (p >= KB_STORAGE_USAGE_WARN_PERCENT) return 'bg-amber-500';
  return 'bg-emerald-600';
}

/**
 * Storage meter: track + fill width by usage %; fill hue follows tier (healthy → full).
 */
export function KnowledgeUsageMeterBar({
  percent,
  heightClass,
  className,
  trackClassName,
  fillClassName,
  'aria-label': ariaLabel,
  'aria-valuenow': ariaValueNow,
}: {
  percent: number;
  /** e.g. `h-1.5` (compact) or `h-2.5` (full) */
  heightClass: string;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  'aria-label': string;
  'aria-valuenow': number;
}) {
  const pct = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-full bg-slate-200/85 shadow-[inset_0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]',
        heightClass,
        className,
        trackClassName,
      )}
      role="progressbar"
      aria-valuenow={ariaValueNow}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'h-full max-w-full rounded-full',
          'motion-reduce:transition-none motion-reduce:duration-0',
          'transition-[width] duration-[680ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]',
          fillClassName ?? usageTierMeterFillClass(pct),
        )}
        style={{
          width: `${pct}%`,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(15,23,42,0.06)',
        }}
      />
    </div>
  );
}
