import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from '@/components/ui';
import { ws } from './workspace';
import { cn } from '@/lib/utils';

export type WorkspaceSectionHeaderProps = {
  id: string;
  title: string;
  description: string;
  /** Shown before the title (e.g. saved-state thumbnail that should not track draft edits). */
  titleLeading?: ReactNode;
  /** Shown inline after the title (e.g. a `2/3` limit badge). */
  titleAddon?: ReactNode;
  /** Shown on the right of the title row (e.g. a toggle beside the heading). */
  inlineEnd?: ReactNode;
  tooltip?: string;
  className?: string;
};

/**
 * Card section title (`h2`) + description (`p`), optional info tooltip beside the title.
 */
export function WorkspaceSectionHeader({
  id,
  title,
  description,
  titleLeading,
  titleAddon,
  inlineEnd,
  tooltip,
  className,
}: WorkspaceSectionHeaderProps) {
  return (
    <header className={cn('min-w-0 overflow-visible', className)}>
      <div className={cn(ws.workspaceEditorSectionHeaderStack, 'min-w-0 overflow-visible')}>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {titleLeading ? (
              <span className="flex shrink-0 items-center" aria-hidden={false}>
                {titleLeading}
              </span>
            ) : null}
            <h2 id={id} className={ws.workspaceEditorSectionTitle}>
              {title}
            </h2>
            {tooltip ? (
              <Tooltip content={tooltip} className="shrink-0">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                  aria-label={`About ${title}`}
                >
                  <Info size={14} strokeWidth={1.75} aria-hidden />
                </button>
              </Tooltip>
            ) : null}
            {titleAddon ? <span className="shrink-0">{titleAddon}</span> : null}
          </div>
          {inlineEnd ? <div className="flex shrink-0 items-center gap-1.5">{inlineEnd}</div> : null}
        </div>
        <p className={ws.workspaceEditorSectionDescription}>{description}</p>
      </div>
    </header>
  );
}
