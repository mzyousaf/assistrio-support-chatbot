import { NavLink, Outlet } from 'react-router-dom';
import { BotWorkspaceProvider, useBotWorkspace } from './BotWorkspaceContext';
import { CustomerWidgetPreviewHost } from './CustomerWidgetPreviewHost';
import { CustomerWidgetPreviewProvider } from './CustomerWidgetPreviewContext';
import { WorkspaceBeforeUnload } from './WorkspaceBeforeUnload';
import { ws } from './workspace';
import { InlineLoader } from '../../components/PageLoader';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';

function BotWorkspaceShell() {
  const { bot, loadState, loadMessage, botId } = useBotWorkspace();

  if (loadState === 'loading') {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center p-6">
            <InlineLoader title="Loading assistant…" />
          </div>
        </div>
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

  return (
    <>
      <WorkspaceBeforeUnload />
      {/*
        Single flex child so the active route (Playground w/ fixed height, or Insights full-bleed)
        always gets a consistent min-h-0 flex column — fixes layout when switching e.g. conversations → profile.
      */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      {/* After route tree: playground preview surface lives in `PlaygroundLayout` (stable mount). */}
      <CustomerWidgetPreviewHost />
    </>
  );
}

export function BotWorkspaceLayout() {
  return (
    <BotWorkspaceProvider>
      <CustomerWidgetPreviewProvider>
        <BotWorkspaceShell />
      </CustomerWidgetPreviewProvider>
    </BotWorkspaceProvider>
  );
}
