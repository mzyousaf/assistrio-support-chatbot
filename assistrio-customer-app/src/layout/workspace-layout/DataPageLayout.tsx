import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { PageIntroStrip } from './PageIntroStrip';
import { WorkspaceContentContainer, type WorkspaceContainerSize } from './WorkspaceContentContainer';
import { workspacePageHeaderTopPaddingClass } from './workspacePageHeaderLayout';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  containerSize?: WorkspaceContainerSize;
  className?: string;
};

export function DataPageLayout({
  title,
  description,
  actions,
  children,
  containerSize = 'wide',
  className,
}: Props) {
  return (
    <WorkspaceContentContainer
      size={containerSize}
      className={cn(containerSize === 'editor' && workspacePageHeaderTopPaddingClass, className)}
    >
      <PageIntroStrip title={title} description={description} actions={actions} />
      {children}
    </WorkspaceContentContainer>
  );
}
