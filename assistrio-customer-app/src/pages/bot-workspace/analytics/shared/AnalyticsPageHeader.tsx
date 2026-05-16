import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ws } from '../../workspace';

type Props = {
  title: string;
  /** Renders directly under the title (e.g. key metrics) before the subtitle. */
  titleDetail?: ReactNode;
  /** Omitted or blank: no subtitle line under the title. */
  subtitle?: string;
  /** Optional note under the subtitle (e.g. how a metric mode works). */
  detail?: ReactNode;
  /** Optional icon shown beside the page title (e.g. matches workspace analytics nav). */
  titleIcon?: LucideIcon;
  /** Override default analytics page title scale (matches bot workspace L1 + sm bump). */
  titleClassName?: string;
  actions?: ReactNode;
  filters?: ReactNode;
};

export function AnalyticsPageHeader({
  title,
  titleDetail,
  subtitle,
  detail,
  titleIcon,
  titleClassName,
  actions,
  filters,
}: Props) {
  const showSubtitle = Boolean(subtitle?.trim());
  const TitleIcon = titleIcon;
  return (
    <header className="shrink-0 border-b border-slate-200/70 bg-white">
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:flex-row sm:items-start sm:justify-between md:px-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5">
            {TitleIcon ? (
              <span
                className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal-100/85 bg-gradient-to-br from-teal-50/90 to-white text-teal-600 shadow-[0_1px_2px_rgba(13,148,136,0.08)]"
                aria-hidden
              >
                <TitleIcon className="size-[1.35rem]" strokeWidth={1.75} />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className={cn(ws.workspaceEditorH1, 'sm:text-2xl', titleClassName)}>{title}</h1>
              {titleDetail ? <div className="mt-2 max-w-2xl">{titleDetail}</div> : null}
              {showSubtitle ? (
                <p className="m-0 mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{(subtitle ?? '').trim()}</p>
              ) : null}
              {detail ? (
                <div
                  className={cn(
                    'max-w-3xl text-xs leading-relaxed text-slate-600',
                    showSubtitle || titleDetail ? 'mt-2' : 'mt-1.5',
                  )}
                >
                  {detail}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="shrink-0 self-start sm:pt-0.5">{actions}</div> : null}
      </div>
      {filters ? (
        <div className="border-t border-slate-100 px-4 py-3 sm:px-5 md:px-8">
          {filters}
        </div>
      ) : null}
    </header>
  );
}
