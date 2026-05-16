import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui';

const fieldTipPanelClass = 'max-w-[min(22rem,calc(100vw-16px))]';

/** Info icon; former field subtitle / helper text is shown in the tooltip. */
export function KnowledgeFieldInfoIcon({ content, ariaLabel }: { content: ReactNode; ariaLabel: string }) {
  return (
    <Tooltip content={content} className="shrink-0" panelClassName={fieldTipPanelClass}>
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        aria-label={ariaLabel}
      >
        <Info size={13} strokeWidth={1.75} aria-hidden />
      </button>
    </Tooltip>
  );
}

export function KnowledgeHeadingInfoIcon({ text, ariaLabel }: { text: string; ariaLabel: string }) {
  return <KnowledgeFieldInfoIcon content={text} ariaLabel={ariaLabel} />;
}
