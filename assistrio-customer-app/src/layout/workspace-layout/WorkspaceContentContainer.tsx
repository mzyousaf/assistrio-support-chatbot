import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const sizeClass = {
  narrow: 'max-w-[42rem]',
  standard: 'max-w-[68rem]',
  wide: 'max-w-[90rem]',
} as const;

export type WorkspaceContainerSize = keyof typeof sizeClass;

type Props = {
  children: ReactNode;
  className?: string;
  size?: WorkspaceContainerSize;
};

export function WorkspaceContentContainer({ children, className, size = 'standard' }: Props) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 pb-12 sm:px-6 md:px-8 md:py-8',
        sizeClass[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
