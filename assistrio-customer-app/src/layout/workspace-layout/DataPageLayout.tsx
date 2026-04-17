import type { ReactNode } from 'react';
import { PageIntroStrip } from './PageIntroStrip';
import { WorkspaceContentContainer, type WorkspaceContainerSize } from './WorkspaceContentContainer';

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
    <WorkspaceContentContainer size={containerSize} className={className}>
      <PageIntroStrip title={title} description={description} actions={actions} />
      {children}
    </WorkspaceContentContainer>
  );
}
