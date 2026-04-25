import { PublishSection } from './PublishSection';
import { PublishWorkspaceProvider } from './PublishWorkspaceContext';

export function PublishWorkspacePage() {
  return (
    <PublishWorkspaceProvider>
      <PublishSection />
    </PublishWorkspaceProvider>
  );
}
