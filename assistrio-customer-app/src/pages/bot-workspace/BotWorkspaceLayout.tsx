import { Outlet } from 'react-router-dom';
import { BotWorkspaceProvider, useBotWorkspace } from './BotWorkspaceContext';
import { TrainingScheduleHelpProvider } from '@/context/TrainingScheduleHelpContext';
import { CustomerWidgetPreviewHost } from './CustomerWidgetPreviewHost';
import { CustomerWidgetPreviewProvider } from './CustomerWidgetPreviewContext';
import { WorkspaceBeforeUnload } from './WorkspaceBeforeUnload';
import { InlineLoader } from '../../components/PageLoader';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { resolveBotWorkspaceFailurePresentation } from '@/lib/workspaceLoadFailurePresentation';
import { ReadOnlyWorkspaceNotice } from '@/components/workspace/ReadOnlyWorkspaceNotice';

function BotWorkspaceShell() {
  const { bot, loadState, loadMessage, botId, reload, canManageBot } = useBotWorkspace();

  const showStaleWorkspaceWhileRefreshing =
    loadState === 'loading' && Boolean(bot && botId && bot.id === botId);

  if (loadState === 'loading' && !showStaleWorkspaceWhileRefreshing) {
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
    const pres = resolveBotWorkspaceFailurePresentation(loadState, loadMessage);
    const loadMsg = loadMessage.trim();
    const showDetail =
      loadState === 'error' && loadMsg && pres.icon !== 'network' && loadMsg !== pres.description.trim();

    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-0 min-h-[calc(100svh-var(--nav-height)-1.5rem)] flex-1 flex-col items-center justify-center p-6">
          <WorkspaceLoadFailureCard
            icon={pres.icon}
            title={pres.title}
            description={pres.description}
            detail={showDetail ? loadMessage : null}
            onPrimary={() => void reload()}
          />
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
        {!canManageBot ? <ReadOnlyWorkspaceNotice className="border-b border-[var(--border-soft)] rounded-none bg-slate-50 px-4 py-2.5" /> : null}
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
      <TrainingScheduleHelpProvider>
        <CustomerWidgetPreviewProvider>
          <BotWorkspaceShell />
        </CustomerWidgetPreviewProvider>
      </TrainingScheduleHelpProvider>
    </BotWorkspaceProvider>
  );
}
