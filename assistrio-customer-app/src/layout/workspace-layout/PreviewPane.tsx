import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PreviewPaneProps = {
  title: string;
  description?: string;
  /** e.g. mobile back row — rendered above the heading */
  leadingToolbar?: ReactNode;
  /** Start of the title row (e.g. inline preview collapse handle) */
  headerLeading?: ReactNode;
  /** Right side of the title row (e.g. collapse control) */
  headerTrailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Scrollable body padding wrapper */
  bodyClassName?: string;
};

/**
 * Right-lane preview shell: divider, stage background, heading, and a flex surface for the preview body.
 * Default is `overflow-y-hidden` so embedded previews (e.g. widget) size to the column without a pane scrollbar. Pass `overflow-y-auto` in `bodyClassName` when a scrollable body is required.
 */
export function PreviewPane({
  title,
  description,
  leadingToolbar,
  headerLeading,
  headerTrailing,
  children,
  className,
  bodyClassName,
}: PreviewPaneProps) {
  return (
    <div
      className={cn(
        'preview-chrome flex min-h-0 min-w-0 flex-1 flex-col border-l border-slate-200/80',
        className,
      )}
      data-preview-pane
    >
      {leadingToolbar ? (
        <div className="preview-chrome shrink-0">{leadingToolbar}</div>
      ) : null}
      <header className="preview-chrome flex shrink-0 items-stretch justify-between gap-0 border-b border-slate-200/80">
        <div className="flex min-w-0 flex-1 items-start gap-2.5 px-4 py-3 sm:gap-3 sm:px-5 sm:py-3.5">
          {headerLeading ? <div className="shrink-0 pt-0.5">{headerLeading}</div> : null}
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[0.8125rem] font-semibold tracking-tight text-slate-900">{title}</h2>
            {description ? (
              <p className="mb-0 mt-1 text-[0.75rem] leading-snug text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        {headerTrailing ? (
          <div className="flex shrink-0 self-stretch border-l border-slate-300/90">{headerTrailing}</div>
        ) : null}
      </header>
      <div
        className={cn(
          'preview-surface flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden',
          bodyClassName ?? 'px-4 py-4 sm:px-5 sm:pb-5 sm:pt-4',
        )}
        data-preview-pane-body
      >
        <div
          className="flex min-h-0 h-full w-full min-w-0 max-h-full flex-1 flex-col"
          data-preview-surface
        >
          {children}
        </div>
      </div>
    </div>
  );
}
