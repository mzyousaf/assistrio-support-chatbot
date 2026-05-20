import { Outlet } from 'react-router-dom';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { KbWorkspacePollingProvider } from '@/context/KbWorkspacePollingContext';

/**
 * Knowledge routes use bot detail secondary nav (no duplicate horizontal tab bar).
 * Training polling only — sub-routes render in {@link KnowledgeBaseLayout}.
 */
export function AdminKnowledgeShell() {
  const { botId } = useAdminBotWorkspace();
  if (!botId) return null;

  return (
    <KbWorkspacePollingProvider botId={botId}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </KbWorkspacePollingProvider>
  );
}
