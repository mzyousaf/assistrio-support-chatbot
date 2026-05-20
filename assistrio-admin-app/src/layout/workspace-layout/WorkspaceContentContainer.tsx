import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  narrow: 'max-w-[42rem]',
  standard: 'max-w-[68rem]',
  wide: 'max-w-[90rem]',
  /** Full content width with standard page gutters (not edge-to-edge). */
  full: 'max-w-none w-full',
} as const;

export type WorkspaceContainerSize = keyof typeof sizeClass;

type Props = {
  children: ReactNode;
  className?: string;
  size?: WorkspaceContainerSize;
};

const pageGutters = 'px-4 py-4 pb-12 sm:px-6 sm:py-6 md:px-8 md:py-8';

export function WorkspaceContentContainer({ children, className, size = 'standard' }: Props) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        pageGutters,
        sizeClass[size],
        size === 'full' && 'min-h-0 flex flex-1 flex-col',
        className,
      )}
    >
      {children}
    </div>
  );
}
