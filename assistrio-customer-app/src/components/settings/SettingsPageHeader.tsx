import type { ReactNode } from 'react';
import { PageIntroStrip } from '@/layout/workspace-layout/PageIntroStrip';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function SettingsPageHeader({ title, description, actions }: Props) {
  return (
    <WorkspaceContentContainer size="standard" className="pb-0">
      <PageIntroStrip title={title} description={description} actions={actions} />
    </WorkspaceContentContainer>
  );
}
