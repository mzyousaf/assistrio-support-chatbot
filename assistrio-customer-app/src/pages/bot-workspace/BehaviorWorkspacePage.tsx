import { BehaviorSection } from './BehaviorSection';
import { BehaviorWorkspaceProvider } from './BehaviorWorkspaceContext';

export function BehaviorWorkspacePage() {
  return (
    <BehaviorWorkspaceProvider>
      <BehaviorSection />
    </BehaviorWorkspaceProvider>
  );
}
