import type { ReactNode } from 'react';

/** Secondary sidebar + scrollable main content for contextual admin areas. */
export function ContextualAreaShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      {sidebar}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</div>
    </div>
  );
}
