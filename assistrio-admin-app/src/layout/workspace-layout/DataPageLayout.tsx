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
  /** When true, skip outer container (parent layout already provides padding). */
  embedded?: boolean;
};

export function DataPageLayout({
  title,
  description,
  actions,
  children,
  containerSize = 'wide',
  className,
  embedded = false,
}: Props) {
  const body = (
    <>
      <PageIntroStrip title={title} description={description} actions={actions} />
      {children}
    </>
  );

  if (embedded) {
    return <div className={className}>{body}</div>;
  }

  return (
    <WorkspaceContentContainer size={containerSize} className={className}>
      {body}
    </WorkspaceContentContainer>
  );
}
