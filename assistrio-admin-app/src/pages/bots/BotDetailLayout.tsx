import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, BookOpen, Brain, LayoutDashboard, MessageSquare, Rocket, User } from 'lucide-react';
import { useAdminBotWorkspace } from '@/auth/AdminBotWorkspaceContext';
import { InlineLoader } from '@/components/PageLoader';
import { WorkspaceLoadFailureCard } from '@/components/WorkspaceLoadFailureCard';
import { ContextualAreaLayout } from '@/layout/ContextualAreaLayout';
import { WorkspaceContentContainer } from '@/layout/workspace-layout';
import type { AdminBotWorkspaceBot } from '@/api/types';

export type BotDetailOutletContext = {
  bot: AdminBotWorkspaceBot;
  reload: () => Promise<void>;
};

export function BotDetailLayout() {
  const { id: botId = '' } = useParams<{ id: string }>();
  const { botId: ctxBotId, bot, loadState, loadMessage, softReload } = useAdminBotWorkspace();
  const effectiveId = botId || ctxBotId;
  const kb = `/bots/${effectiveId}/knowledge`;

  const navItems = [
    { to: `/bots/${effectiveId}`, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `/bots/${effectiveId}/profile`, label: 'Profile', icon: User, end: true },
    { to: `/bots/${effectiveId}/behavior`, label: 'Behavior', icon: Brain, end: true },
    {
      to: `${kb}/overview`,
      label: 'Knowledge',
      icon: BookOpen,
      end: false,
      children: [
        { to: `${kb}/overview`, label: 'Overview', end: true },
        { to: `${kb}/documents`, label: 'Documents', end: false },
        { to: `${kb}/faqs`, label: 'FAQs', end: false },
        { to: `${kb}/notes`, label: 'Notes', end: false },
        { to: `${kb}/datasheets`, label: 'Datasheets', end: true },
      ],
    },
    { to: `/bots/${effectiveId}/deploy`, label: 'Deploy', icon: Rocket, end: true },
    { to: `/bots/${effectiveId}/conversations`, label: 'Conversations', icon: MessageSquare, end: true },
    { to: `/bots/${effectiveId}/analytics`, label: 'Bot analytics', icon: BarChart3, end: true },
  ];

  if (!effectiveId) {
    return (
      <WorkspaceContentContainer>
        <p className="text-sm text-slate-500">Missing bot id.</p>
      </WorkspaceContentContainer>
    );
  }

  if (loadState === 'loading') {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-[40vh] items-center justify-center">
          <InlineLoader title="Loading bot…" />
        </div>
      </WorkspaceContentContainer>
    );
  }

  if (loadState !== 'ok' || !bot) {
    return (
      <WorkspaceContentContainer size="full">
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <WorkspaceLoadFailureCard
            icon={loadState === 'not_found' ? 'not_found' : 'generic'}
            title={loadState === 'not_found' ? 'Bot not found' : 'Could not load bot'}
            description={loadMessage || 'Something went wrong.'}
            onPrimary={() => void softReload()}
            secondary={{ to: '/bots', label: 'Back to bots' }}
          />
        </div>
      </WorkspaceContentContainer>
    );
  }

  return (
    <ContextualAreaLayout
      title={bot.name?.trim() || 'Bot'}
      subtitle="Bot workspace"
      navItems={navItems}
      mobileAriaLabel="Bot sections"
      showSecondary
    >
      <div className="mb-6">
        <NavLink
          to="/bots"
          className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate-500 no-underline hover:text-primary"
        >
          <ArrowLeft size={15} aria-hidden />
          All bots
        </NavLink>
        <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900 md:text-xl lg:hidden">
          {bot.name?.trim() || 'Untitled bot'}
        </h1>
        <p className="mt-1 font-mono text-[0.75rem] text-slate-400 lg:hidden">{effectiveId}</p>
      </div>
      <Outlet context={{ bot, reload: softReload } satisfies BotDetailOutletContext} />
    </ContextualAreaLayout>
  );
}
