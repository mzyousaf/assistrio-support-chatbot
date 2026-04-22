import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { PublishSection } from './PublishSection';
import { PublishWorkspaceProvider } from './PublishWorkspaceContext';

export function PublishWorkspacePage() {
  return (
    <PublishWorkspaceProvider>
      <WidgetPreviewContainer>
        <PublishSection />
      </WidgetPreviewContainer>
    </PublishWorkspaceProvider>
  );
}
