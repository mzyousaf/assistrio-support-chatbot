import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ANALYTICS_CARD_MAX_HEIGHT_PX } from './analyticsChartTheme';

type Props = {
  /** When omitted, no card title is rendered (use in-body headings instead). */
  title?: string;
  /** Renders directly under the title (e.g. summary stats) before the description. */
  titleDetail?: ReactNode;
  description?: string;
  /** Renders in the header row (e.g. date range) without changing card layout when omitted. */
  titleAside?: ReactNode;
  /**
   * Second header column (e.g. sibling title) aligned with the chart body’s right column on large screens.
   * When set, the header uses a two-column layout: title/description | titleColumnEnd (+ titleAside below it in that column).
   */
  titleColumnEnd?: ReactNode;
  /** Section + body use flex column so the body can grow to fill available height (split layouts). */
  fillVertical?: boolean;
  /** Optional max-width / flex classes for the title + description column (split chart + sidebar layouts). */
  headerLeadingClassName?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /**
   * Split layouts (e.g. chart + sidebar) need more than {@link ANALYTICS_CARD_MAX_HEIGHT_PX}px.
   * When true, the card is not height-capped and the body does not scroll as a whole.
   */
  noMaxHeight?: boolean;
};

export function AnalyticsChartCard({
  title,
  titleDetail,
  description,
  titleAside,
  titleColumnEnd,
  fillVertical,
  headerLeadingClassName,
  children,
  className,
  bodyClassName,
  noMaxHeight,
}: Props) {
  const showHeader = Boolean(title || titleDetail || description || titleAside || titleColumnEnd);

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[0.625rem] border border-slate-100 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5',
        fillVertical && 'min-h-0 flex-1',
        className,
      )}
      style={noMaxHeight ? undefined : { maxHeight: ANALYTICS_CARD_MAX_HEIGHT_PX }}
    >
      {showHeader ? (
        titleColumnEnd ? (
          <div className="mb-3 flex shrink-0 flex-col gap-3 sm:mb-4 lg:flex-row lg:items-start lg:gap-0">
            <div className={cn('min-w-0 flex-1 lg:pr-6', headerLeadingClassName)}>
              {title ? (
                <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">{title}</h2>
              ) : null}
              {titleDetail ? <div className={title ? 'mt-1' : undefined}>{titleDetail}</div> : null}
              {description ? (
                <p
                  className={cn(
                    'mb-0 text-xs leading-snug text-slate-500 sm:text-[13px]',
                    title || titleDetail ? 'mt-1' : 'm-0',
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {(titleColumnEnd || titleAside) && (
              <div className="flex w-full min-w-0 shrink-0 flex-col items-stretch gap-1 lg:w-[32%] lg:max-w-[min(100%,22rem)] lg:pl-6">
                {titleColumnEnd}
                {titleAside ? <div className="pt-0.5">{titleAside}</div> : null}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-2 sm:mb-4">
            <div className={cn('min-w-0 flex-1', headerLeadingClassName)}>
              {title ? (
                <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900 sm:text-base">{title}</h2>
              ) : null}
              {titleDetail ? <div className={title ? 'mt-1' : undefined}>{titleDetail}</div> : null}
              {description ? (
                <p
                  className={cn(
                    'mb-0 text-xs leading-snug text-slate-500 sm:text-[13px]',
                    title || titleDetail ? 'mt-1' : 'm-0',
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {titleAside ? <div className="shrink-0 pt-0.5">{titleAside}</div> : null}
          </div>
        )
      ) : null}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-x-hidden',
          noMaxHeight ? 'overflow-y-hidden' : 'overflow-y-auto',
          !fillVertical && !noMaxHeight && 'min-h-[200px]',
          !fillVertical && noMaxHeight && 'min-h-0',
          fillVertical && 'flex min-h-0 flex-1 flex-col',
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
