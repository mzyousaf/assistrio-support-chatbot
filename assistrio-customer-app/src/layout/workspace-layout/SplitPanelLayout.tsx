import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  primary: ReactNode;
  secondary: ReactNode;
  className?: string;
};

export function SplitPanelLayout({ primary, secondary, className }: Props) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-start lg:gap-10',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-6">{primary}</div>
      <aside className="min-w-0 space-y-4 lg:sticky lg:top-[calc(var(--nav-height)+1rem)] lg:self-start">
        {secondary}
      </aside>
    </div>
  );
}
