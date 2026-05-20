import type { MouseEvent, ReactNode } from 'react';
import { useOptionalOpenTrainingScheduleHelp } from '@/context/TrainingScheduleHelpContext';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  /** Native tooltip (exact run time, etc.). */
  title?: string | null;
  className?: string;
  /** Extra hint appended to title when help is available. */
  helpHint?: string;
};

/**
 * Wraps a countdown (or schedule line). When the workspace provides {@link TrainingScheduleHelpProvider},
 * the control opens the training schedule help modal on click.
 */
export function InteractiveTrainingScheduleCountdown({ children, title, className, helpHint }: Props) {
  const openHelp = useOptionalOpenTrainingScheduleHelp();
  const tipBase = typeof title === 'string' && title.trim() ? title.trim() : '';
  const hint = helpHint?.trim() || 'Click for how schedules work';
  const fullTitle = openHelp && tipBase ? `${tipBase}\n\n${hint}` : openHelp ? hint : tipBase || undefined;

  const alignClass = 'inline-flex items-center justify-center align-middle leading-none';

  if (!openHelp) {
    return (
      <span className={cn(alignClass, className)} title={tipBase || undefined}>
        {children}
      </span>
    );
  }

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    openHelp();
  };

  return (
    <button
      type="button"
      className={cn(
        alignClass,
        className,
        'cursor-pointer border-0 bg-transparent p-0 text-left [font:inherit]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:ring-offset-1',
      )}
      title={fullTitle}
      aria-label={`${tipBase ? `${tipBase}. ` : ''}Open how training schedules work`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
