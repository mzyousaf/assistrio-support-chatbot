import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotWorkspaceLayout } from './BotWorkspaceLayout';
import { BOT_WORKSPACE_READ_ONLY_NOTE } from '@/lib/botsListMessages';

vi.mock('./BotWorkspaceContext', () => ({
  BotWorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBotWorkspace: () => ({
    bot: { id: 'bot-1', name: 'Agent' },
    botId: 'bot-1',
    loadState: 'ok',
    loadMessage: '',
    reload: vi.fn(),
    canManageBot: false,
  }),
}));

vi.mock('./CustomerWidgetPreviewHost', () => ({ CustomerWidgetPreviewHost: () => null }));
vi.mock('./CustomerWidgetPreviewContext', () => ({
  CustomerWidgetPreviewProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./WorkspaceBeforeUnload', () => ({ WorkspaceBeforeUnload: () => null }));
vi.mock('@/context/TrainingScheduleHelpContext', () => ({
  TrainingScheduleHelpProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('BotWorkspaceLayout read-only banner', () => {
  afterEach(() => cleanup());

  it('shows read-only note for workspace members', () => {
    render(
      <MemoryRouter initialEntries={['/bots/bot-1/playground']}>
        <Routes>
          <Route path="/bots/:id/*" element={<BotWorkspaceLayout />}>
            <Route path="playground" element={<div>Playground content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(BOT_WORKSPACE_READ_ONLY_NOTE)).toBeTruthy();
    expect(screen.getByText('Playground content')).toBeTruthy();
  });
});
