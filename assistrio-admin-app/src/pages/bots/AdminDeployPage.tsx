import { useMemo, type ReactNode } from 'react';
import { BotLifecycleProvider } from '@/context/BotLifecycleContext';
import { PublishSection } from '@/pages/bot-workspace/PublishSection';
import { PublishWorkspaceProvider, usePublishWorkspace } from '@/pages/bot-workspace/PublishWorkspaceContext';

function DeployLifecycleBridge({ children }: { children: ReactNode }) {
  const publish = usePublishWorkspace();
  const value = useMemo(
    () => ({
      openPublish: () => publish.setStatus('published'),
      openDraft: () => publish.setStatus('draft'),
    }),
    [publish],
  );
  return <BotLifecycleProvider value={value}>{children}</BotLifecycleProvider>;
}

export function AdminDeployPage() {
  return (
    <PublishWorkspaceProvider>
      <DeployLifecycleBridge>
        <PublishSection />
      </DeployLifecycleBridge>
    </PublishWorkspaceProvider>
  );
}
