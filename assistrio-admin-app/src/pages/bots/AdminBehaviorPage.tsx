import { BehaviorSection } from '@/pages/bot-workspace/BehaviorSection';
import { BehaviorWorkspaceProvider } from '@/pages/bot-workspace/BehaviorWorkspaceContext';

export function AdminBehaviorPage() {
  return (
    <BehaviorWorkspaceProvider>
      <BehaviorSection />
    </BehaviorWorkspaceProvider>
  );
}
