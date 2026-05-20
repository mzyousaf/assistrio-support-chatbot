import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Standard gutters for contextual areas (Insights, Settings, Admin bots, bot/customer detail).
 * Full width = use available content area, not edge-to-edge.
 */
export const contextualMainClassName =
  'flex min-h-0 min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10';

export function ContextualMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(contextualMainClassName, className)}>{children}</div>;
}
