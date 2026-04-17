import { NavLink, Outlet } from 'react-router-dom';
import { BotWorkspaceProvider, useBotWorkspace } from './BotWorkspaceContext';
import { ws } from './workspace';
import { InlineLoader } from '../../components/PageLoader';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';

function BotWorkspaceShell() {
  const { bot, loadState, loadMessage, botId } = useBotWorkspace();

  if (loadState === 'loading') {
    return (
      <WorkspaceContentContainer>
        <InlineLoader title="Loading assistant…" />
      </WorkspaceContentContainer>
    );
  }

  if (loadState === 'not_found' || loadState === 'forbidden' || loadState === 'error') {
    return (
      <WorkspaceContentContainer>
        <div className={ws.errorBox}>
          <p>{loadMessage}</p>
          <NavLink to="/bots" className={ws.back}>
            ← Back to agents
          </NavLink>
        </div>
      </WorkspaceContentContainer>
    );
  }

  if (!bot || !botId) return null;

  return <Outlet />;
}

export function BotWorkspaceLayout() {
  return (
    <BotWorkspaceProvider>
      <BotWorkspaceShell />
    </BotWorkspaceProvider>
  );
}
