import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { AdminWorkspaceDocument } from '@/api/types';
import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils';
import {
  baselineDocumentRowTrainingStatus,
  knowledgeTrainingListScheduleSubline,
  knowledgeTrainingNextDueTooltip,
  knowledgeTrainingStatusBadgeClassName,
  knowledgeTrainingStatusDotClassName,
  knowledgeTrainingStatusPillHoverDescription,
  normalizeKnowledgeTrainingStatus,
  type KnowledgeTrainingStatus,
} from '@/lib/knowledgeTrainingStatus';
import type { WorkspaceDocumentDisplayOptions } from '@/lib/knowledgeItemDisplayStatus';
import {
  documentPipelineStatusPillHoverDescription,
  documentTrainingDisplayBadgeClassName,
  documentTrainingDisplayDotClassName,
  documentTrainingUiPhase,
} from '@/pages/bot-workspace/knowledge/knowledgeViewTypes';
import { InteractiveTrainingScheduleCountdown } from '@/components/knowledge/InteractiveTrainingScheduleCountdown';

/** Drives live MM:SS / HH:MM:SS countdowns; re-ticks every second while active. */
export function useNextRunAfterTick(runAfterIso: string | null | undefined, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  // When the countdown turns on or `runAfter` changes, `now` was frozen — remaining time looked too large until the first interval tick.
  useLayoutEffect(() => {
    if (!active) return;
    setNow(Date.now());
  }, [active, runAfterIso]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, runAfterIso]);
  return now;
}

export function useKbTrainingScheduleSubline(
  runAfter: string | null | undefined,
  canon: KnowledgeTrainingStatus,
): { subline: string | null; sublineTitle: string | null } {
  const raw = typeof runAfter === 'string' ? runAfter.trim() : '';
  const hasCountdown = canon === 'queued' && Boolean(raw);
  const now = useNextRunAfterTick(runAfter, hasCountdown);
  return useMemo(() => {
    const line = hasCountdown ? knowledgeTrainingListScheduleSubline(canon, raw, now) : null;
    const tip = line && String(line).trim() ? knowledgeTrainingNextDueTooltip(runAfter) : null;
    return { subline: line, sublineTitle: tip };
  }, [hasCountdown, canon, raw, now, runAfter]);
}

const rowSizeMonoTimerClass =
  'font-mono text-[11px] font-semibold tabular-nums tracking-tight leading-none text-slate-600 underline decoration-dotted decoration-slate-400/70 underline-offset-2';

/**
 * Document list row under title: `12 KB | 01:05` when a training countdown applies (status column shows pill only).
 */
export function DocumentListRowSizeWithTrainingCountdown({
  sizeLabel,
  runAfter,
  trainingCanon,
  className,
  /** When set, hides the training countdown during text extraction (status still shows Extracting). */
  doc,
}: {
  sizeLabel: string;
  runAfter: string | null | undefined;
  trainingCanon: KnowledgeTrainingStatus | string | null | undefined;
  className?: string;
  doc?: AdminWorkspaceDocument;
}) {
  const canon = normalizeKnowledgeTrainingStatus(trainingCanon);
  const hideScheduleForExtracting = doc != null && documentTrainingUiPhase(doc) === 'extracting';
  const { subline, sublineTitle } = useKbTrainingScheduleSubline(
    hideScheduleForExtracting ? null : (runAfter ?? null),
    hideScheduleForExtracting ? 'pending' : canon,
  );
  const s = typeof subline === 'string' && subline.trim() ? subline.trim() : '';
  return (
    <span
      className={cn(
        'mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs tabular-nums text-slate-500',
        className,
      )}
    >
      <span className="min-w-0 shrink-0">{sizeLabel}</span>
      {s ? (
        <>
          <span className="inline-flex shrink-0 items-center self-center text-slate-300 leading-none" aria-hidden>
            |
          </span>
          <InteractiveTrainingScheduleCountdown className={rowSizeMonoTimerClass} title={sublineTitle || null}>
            {s}
          </InteractiveTrainingScheduleCountdown>
        </>
      ) : null}
    </span>
  );
}

const scheduleMonoClass =
  'font-mono text-[10px] font-medium tabular-nums tracking-tight leading-none text-slate-600 underline decoration-dotted decoration-slate-400/70 underline-offset-2 sm:text-[11px]';

/**
 * Training delay countdown / “Training soon”, separate from the main status badge.
 * Shown only when lifecycle is **queued** (`Training Queued`); not for `pending` / `processing` / etc.
 */
export function KnowledgeTrainingScheduleInline({
  runAfter,
  trainingStatusForSchedule,
  className,
  /** Merges with default mono/timer styles (e.g. analytics card larger type). */
  timerClassName,
}: {
  runAfter: string | null | undefined;
  trainingStatusForSchedule: KnowledgeTrainingStatus | string | null | undefined;
  className?: string;
  timerClassName?: string;
}) {
  const c = normalizeKnowledgeTrainingStatus(trainingStatusForSchedule);
  const { subline, sublineTitle } = useKbTrainingScheduleSubline(runAfter ?? null, c);
  if (c !== 'queued') return null;
  const s = typeof subline === 'string' && subline.trim() ? subline.trim() : '';
  if (!s) return null;
  return (
    <span className={cn('flex min-w-0 max-w-full flex-col items-start', className)}>
      <InteractiveTrainingScheduleCountdown
        className={cn(scheduleMonoClass, timerClassName)}
        title={sublineTitle || null}
      >
        {s}
      </InteractiveTrainingScheduleCountdown>
    </span>
  );
}

const sublineTextClass =
  'max-w-full pl-[calc(0.25rem+0.25rem+0.625rem)] text-[10px] font-normal leading-snug tracking-tight text-slate-500';

const timerMonoClass =
  'font-mono text-[10px] font-medium tabular-nums tracking-tight leading-none text-slate-700 sm:text-[11px]';

/** Pill status chip driven by normalized KB lifecycle (lists + non-document surfaces). */
export function KbTrainingStatusTag({
  label,
  statusForBadge,
  subline,
  sublineTitle,
  /** Default keeps timer / subline on the same row as the pill (`Status | 01:00`). */
  sublineLayout = 'inline-pipe',
  className,
  /** Portal tooltip on hover for the whole tag (list rows). */
  hoverTooltip,
}: {
  label: string;
  statusForBadge: KnowledgeTrainingStatus | string | null | undefined;
  subline?: string | null;
  /** Shown as native `title` on the subline (e.g. full “Next training due on …”). */
  sublineTitle?: string | null;
  /** `inline-pipe`: `Training Required | 01:00` on one row; `below`: subline under the pill. */
  sublineLayout?: 'below' | 'inline-pipe';
  className?: string;
  hoverTooltip?: string | null;
}) {
  const s = typeof subline === 'string' && subline.trim() ? subline.trim() : '';
  const tip = typeof sublineTitle === 'string' && sublineTitle.trim() ? sublineTitle.trim() : '';
  const hoverTip = typeof hoverTooltip === 'string' && hoverTooltip.trim() ? hoverTooltip.trim() : '';

  const pill = (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-none',
        knowledgeTrainingStatusBadgeClassName(statusForBadge),
      )}
    >
      <span
        className={cn('h-1 w-1 shrink-0 rounded-full', knowledgeTrainingStatusDotClassName(statusForBadge))}
        aria-hidden
      />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );

  const body =
    sublineLayout === 'inline-pipe' && s ? (
      <span className={cn('inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
        {pill}
        <span className="inline-flex items-center self-center text-slate-300 leading-none" aria-hidden>
          |
        </span>
        <InteractiveTrainingScheduleCountdown
          className={cn(
            timerMonoClass,
            tip ? 'underline decoration-dotted decoration-slate-400/70 underline-offset-2' : undefined,
          )}
          title={tip || null}
        >
          {s}
        </InteractiveTrainingScheduleCountdown>
      </span>
    ) : (
      <span className={cn('inline-flex max-w-full min-w-0 flex-col gap-0.5 items-start', className)}>
        {pill}
        {s ? (
          <InteractiveTrainingScheduleCountdown
            className={cn(
              sublineTextClass,
              tip ? 'underline decoration-dotted decoration-slate-400/70 underline-offset-2' : undefined,
            )}
            title={tip || null}
          >
            {s}
          </InteractiveTrainingScheduleCountdown>
        ) : null}
      </span>
    );

  if (hoverTip) {
    return (
      <Tooltip content={hoverTip} panelClassName="max-w-[18rem] text-pretty" side="top">
        {body}
      </Tooltip>
    );
  }
  return body;
}

/** KB list / analytics: live countdown; default `inline-pipe` = `… | MM:SS` beside the pill. */
export function KbTrainingStatusTagWithSchedule({
  label,
  statusForBadge,
  row,
  dotCanon,
  className,
  sublineLayout = 'inline-pipe',
  /** Portal tooltip describing this training status (knowledge list rows). */
  showHoverDescription = false,
}: {
  label: string;
  statusForBadge: KnowledgeTrainingStatus | string | null | undefined;
  row: { runAfter?: string | null };
  dotCanon: KnowledgeTrainingStatus | string | null | undefined;
  className?: string;
  sublineLayout?: 'below' | 'inline-pipe';
  showHoverDescription?: boolean;
}) {
  const canon = normalizeKnowledgeTrainingStatus(dotCanon);
  const { subline, sublineTitle } = useKbTrainingScheduleSubline(row.runAfter ?? null, canon);
  const hoverTooltip = showHoverDescription ? knowledgeTrainingStatusPillHoverDescription(canon) : null;
  return (
    <KbTrainingStatusTag
      label={label}
      statusForBadge={statusForBadge}
      subline={subline}
      sublineTitle={sublineTitle}
      sublineLayout={sublineLayout}
      className={className}
      hoverTooltip={hoverTooltip}
    />
  );
}

/** Document pipeline-aware pill (upload / extraction / training stages). */
export function DocumentKbTrainingStatusTag({
  doc,
  label,
  subline,
  sublineTitle,
  sublineLayout = 'below',
  className,
  documentDisplayOpts,
  /** When true (default), upload / text-extraction phases use the same explanations as the knowledge status help modal. */
  showPipelineHoverDescription = true,
  /** When set (including `null`), overrides the automatic pipeline tooltip. */
  hoverTooltip: hoverTooltipOverride,
}: {
  doc: AdminWorkspaceDocument;
  label: string;
  subline?: string | null;
  sublineTitle?: string | null;
  sublineLayout?: 'below' | 'inline-pipe';
  className?: string;
  /** Align pill styling with {@link formatDocumentTrainingStatusDisplayLabel} when passing {@link WorkspaceDocumentDisplayOptions}. */
  documentDisplayOpts?: WorkspaceDocumentDisplayOptions;
  showPipelineHoverDescription?: boolean;
  hoverTooltip?: string | null;
}) {
  const s = typeof subline === 'string' && subline.trim() ? subline.trim() : '';
  const tip = typeof sublineTitle === 'string' && sublineTitle.trim() ? sublineTitle.trim() : '';
  const pipelineHover =
    hoverTooltipOverride === undefined && showPipelineHoverDescription
      ? documentPipelineStatusPillHoverDescription(doc)
      : null;
  const trainingHover =
    hoverTooltipOverride === undefined
      ? knowledgeTrainingStatusPillHoverDescription(
          normalizeKnowledgeTrainingStatus(baselineDocumentRowTrainingStatus(doc)),
        )
      : null;
  const hoverTipRaw =
    hoverTooltipOverride !== undefined ? hoverTooltipOverride : (pipelineHover ?? trainingHover);
  const hoverTip = typeof hoverTipRaw === 'string' && hoverTipRaw.trim() ? hoverTipRaw.trim() : '';

  const pill = (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-px text-[11px] font-medium leading-none',
        documentTrainingDisplayBadgeClassName(doc, documentDisplayOpts),
      )}
    >
      <span
        className={cn('h-1 w-1 shrink-0 rounded-full', documentTrainingDisplayDotClassName(doc, documentDisplayOpts))}
        aria-hidden
      />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );

  if (sublineLayout === 'inline-pipe' && s) {
    const body = (
      <span className={cn('inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5', className)}>
        {pill}
        <span className="inline-flex items-center self-center text-slate-300 leading-none" aria-hidden>
          |
        </span>
        <InteractiveTrainingScheduleCountdown
          className={cn(
            timerMonoClass,
            tip ? 'underline decoration-dotted decoration-slate-400/70 underline-offset-2' : undefined,
          )}
          title={tip || null}
        >
          {s}
        </InteractiveTrainingScheduleCountdown>
      </span>
    );
    if (hoverTip) {
      return (
        <Tooltip content={hoverTip} panelClassName="max-w-[18rem] text-pretty" side="top">
          {body}
        </Tooltip>
      );
    }
    return body;
  }

  const body = (
    <span className={cn('inline-flex max-w-full min-w-0 flex-col gap-0.5 items-start', className)}>
      {pill}
      {s ? (
        <InteractiveTrainingScheduleCountdown
          className={cn(
            sublineTextClass,
            tip ? 'underline decoration-dotted decoration-slate-400/70 underline-offset-2' : undefined,
          )}
          title={tip || null}
        >
          {s}
        </InteractiveTrainingScheduleCountdown>
      ) : null}
    </span>
  );
  if (hoverTip) {
    return (
      <Tooltip content={hoverTip} panelClassName="max-w-[18rem] text-pretty" side="top">
        {body}
      </Tooltip>
    );
  }
  return body;
}

/** Documents table / detail: live schedule line; default timer below pill. */
export function DocumentKbTrainingStatusTagWithSchedule({
  doc,
  label,
  runAfter,
  trainingCanon,
  className,
  sublineLayout = 'below',
  documentDisplayOpts,
  showPipelineHoverDescription,
  hoverTooltip,
}: {
  doc: AdminWorkspaceDocument;
  label: string;
  runAfter: string | null | undefined;
  trainingCanon: KnowledgeTrainingStatus;
  className?: string;
  sublineLayout?: 'below' | 'inline-pipe';
  documentDisplayOpts?: WorkspaceDocumentDisplayOptions;
  showPipelineHoverDescription?: boolean;
  hoverTooltip?: string | null;
}) {
  const hideScheduleForExtracting = documentTrainingUiPhase(doc) === 'extracting';
  const { subline, sublineTitle } = useKbTrainingScheduleSubline(
    hideScheduleForExtracting ? null : runAfter,
    hideScheduleForExtracting ? 'pending' : trainingCanon,
  );
  return (
    <DocumentKbTrainingStatusTag
      doc={doc}
      label={label}
      subline={subline}
      sublineTitle={sublineTitle}
      sublineLayout={sublineLayout}
      className={className}
      documentDisplayOpts={documentDisplayOpts}
      showPipelineHoverDescription={showPipelineHoverDescription}
      hoverTooltip={hoverTooltip}
    />
  );
}
