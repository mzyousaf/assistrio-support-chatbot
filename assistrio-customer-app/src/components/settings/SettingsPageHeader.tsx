import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SettingsPageIcon } from '@/components/settings/SettingsPageIcon';
import { PageIntroStrip } from '@/layout/workspace-layout/PageIntroStrip';
import { WorkspaceContentContainer } from '@/layout/workspace-layout/WorkspaceContentContainer';
import { workspacePageHeaderTopPaddingClass } from '@/layout/workspace-layout/workspacePageHeaderLayout';
import type { SettingsNavRoute } from '@/lib/settingsNavigation';

type Props = {
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  titleAddon?: ReactNode;
  filters?: ReactNode;
  settingsRoute?: SettingsNavRoute;
};

export function SettingsPageHeader({
  title,
  description,
  meta,
  actions,
  icon,
  titleAddon,
  filters,
  settingsRoute,
}: Props) {
  const headerIcon = icon ?? (settingsRoute ? <SettingsPageIcon route={settingsRoute} /> : undefined);

  return (
    <WorkspaceContentContainer size="editor" className={cn('pb-0', workspacePageHeaderTopPaddingClass)}>
      <PageIntroStrip
        title={title}
        description={description}
        meta={meta}
        actions={actions}
        titleAddon={titleAddon}
        filters={filters}
        icon={headerIcon}
        className="mb-0 pb-3"
      />
    </WorkspaceContentContainer>
  );
}
