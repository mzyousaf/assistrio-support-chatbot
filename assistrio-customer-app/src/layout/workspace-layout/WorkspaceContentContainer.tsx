import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  narrow: 'max-w-[42rem]',
  standard: 'max-w-[68rem]',
  wide: 'max-w-[90rem]',
  /** Edge-to-edge: no max width; use with `flex-1 min-h-0` on Insights and similar full-bleed views */
  full: 'max-w-none w-full',
} as const;

export type WorkspaceContainerSize = keyof typeof sizeClass;

type Props = {
  children: ReactNode;
  className?: string;
  size?: WorkspaceContainerSize;
};

export function WorkspaceContentContainer({ children, className, size = 'standard' }: Props) {
  const isFull = size === 'full';
  return (
    <div
      className={cn(
        isFull
          ? 'min-h-0 w-full max-w-none flex-1 flex flex-col p-0'
          : 'mx-auto w-full px-4 py-6 pb-12 sm:px-6 md:px-8 md:py-8',
        !isFull && sizeClass[size],
        isFull && sizeClass.full,
        className,
      )}
    >
      {children}
    </div>
  );
}
