import type { CustomerKnowledgeUsage } from '@/api/types';
import type { ReactNode } from 'react';
import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { cn } from '@/lib/utils';
import {
  clampKnowledgeUsagePercent,
  KnowledgeUsageMeterBar,
  usageTierBadgeClasses,
} from '@/components/knowledge/KnowledgeUsageMeterBar';

function percentUsedTagText(usage: CustomerKnowledgeUsage, barPctRounded: number): string {
  const p = usage.percentUsed;
  if (Number.isFinite(p)) {
    const r = Math.round(p * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  return String(barPctRounded);
}

/** Free space line under the headline (full layout). */
function freeSpaceSummary(usage: CustomerKnowledgeUsage): string | null {
  const max = usage.maxBytes;
  if (!Number.isFinite(max) || max <= 0) return null;
  const r = usage.remainingBytes;
  if (!Number.isFinite(r)) return null;
  if (r <= 0) return 'No space remaining at your current limit.';
  return `${formatKnowledgeBytes(r)} available`;
}

export function KnowledgeStorageUsagePanel({
  usage,
  variant,
  className,
  /** Shown right-aligned on the compact usage row (e.g. “View sources”). */
  compactTrailing,
}: {
  usage: CustomerKnowledgeUsage | null | undefined;
  variant: 'full' | 'compact';
  className?: string;
  compactTrailing?: ReactNode;
}) {
  if (!usage) {
    return variant === 'compact' ? null : (
      <p className={cn('m-0 text-xs text-slate-500', className)}>Storage usage is loading…</p>
    );
  }

  const pctRaw = clampKnowledgeUsagePercent(usage);
  const barPctRounded = Math.round(pctRaw);
  const freeLine = freeSpaceSummary(usage);

  if (variant === 'compact') {
    return (
      <div className={cn('flex min-w-0 flex-col gap-2.5', className)}>
        <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Usage</p>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="m-0 min-w-0 flex-1 text-[9px] font-semibold tabular-nums leading-tight text-slate-800">
            <span className="tabular-nums">{formatKnowledgeBytes(usage.totalBytes)}</span>
            <span className="font-normal text-slate-400"> / </span>
            <span className="tabular-nums">{formatKnowledgeBytes(usage.maxBytes)}</span>
          </p>
          {compactTrailing ? (
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end">{compactTrailing}</div>
          ) : null}
        </div>
        <KnowledgeUsageMeterBar
          percent={pctRaw}
          heightClass="h-1.5"
          aria-valuenow={barPctRounded}
          aria-label="Knowledge storage used versus limit"
        />
      </div>
    );
  }

  const pctTag = percentUsedTagText(usage, barPctRounded);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="min-w-0 shrink-0 space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between gap-x-3 gap-y-2 sm:gap-x-4">
          <p className="m-0 min-w-0 pr-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trainable knowledge
          </p>
          <span
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold tabular-nums leading-none ring-1',
              usageTierBadgeClasses(barPctRounded),
            )}
          >
            {pctTag}% used
          </span>
        </div>

        <div className="min-w-0 space-y-3 sm:space-y-3.5">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]">
            <span className="tabular-nums">{formatKnowledgeBytes(usage.totalBytes)}</span>
            <span className="text-base font-medium text-slate-400 sm:text-lg">of</span>
            <span className="tabular-nums text-slate-700">{formatKnowledgeBytes(usage.maxBytes)}</span>
          </p>
          {freeLine ? (
            <p className="m-0 text-sm leading-relaxed text-slate-600">{freeLine}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex min-h-0 flex-col gap-4 border-t border-slate-100 pt-6 sm:gap-5 sm:pt-8">
        <KnowledgeUsageMeterBar
          percent={pctRaw}
          heightClass="h-2.5"
          aria-valuenow={barPctRounded}
          aria-label={`Knowledge storage ${pctTag}% used of limit`}
        />
        <p className="m-0 max-w-prose text-[11px] leading-relaxed text-slate-500">
          UTF-8 bytes of trainable knowledge; widget and chat are not counted.
        </p>
      </div>
    </div>
  );
}
