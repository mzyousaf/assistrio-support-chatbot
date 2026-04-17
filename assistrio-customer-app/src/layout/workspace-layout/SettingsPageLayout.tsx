import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageIntroStrip } from './PageIntroStrip';
import { WorkspaceContentContainer, type WorkspaceContainerSize } from './WorkspaceContentContainer';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  support: ReactNode;
  children: ReactNode;
  containerSize?: WorkspaceContainerSize;
  className?: string;
  /** Extra classes for the primary (left) column */
  editorClassName?: string;
};

export function SettingsPageLayout({
  title,
  description,
  actions,
  support,
  children,
  containerSize = 'standard',
  className,
  editorClassName,
}: Props) {
  return (
    <WorkspaceContentContainer size={containerSize} className={className}>
      <PageIntroStrip title={title} description={description} actions={actions} />
      <div
        className={cn(
          'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(17.5rem,28%)] lg:items-start lg:gap-10',
        )}
      >
        <div className={cn('flex min-w-0 flex-col gap-6', editorClassName)}>{children}</div>
        <aside
          className="min-w-0 space-y-4 lg:sticky lg:top-[calc(var(--nav-height)+1rem)] lg:self-start"
        >
          {support}
        </aside>
      </div>
    </WorkspaceContentContainer>
  );
}
