import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundSection } from './PlaygroundSection';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from '@/lib/botsListMessages';
import { PLAN_LIMIT_AI_CREDITS_CODE, PLAN_LIMIT_AI_CREDITS_MESSAGE } from '@/lib/resolveChatRuntimeErrorMessage';

const mockPostChat = vi.fn();

vi.mock('../../api/customerApi', () => ({
  postCustomerBotChat: (...args: unknown[]) => mockPostChat(...args),
}));

vi.mock('../../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      workspaces: [{ id: 'ws-1', role: 'owner', name: 'Test' }],
      activeWorkspaceId: 'ws-1',
    },
  }),
}));

vi.mock('./BotWorkspaceContext', () => ({
  useBotWorkspace: () => ({
    bot: { id: 'bot-1', status: 'published', name: 'Test' },
    botId: 'bot-1',
  }),
}));

describe('PlaygroundSection chat errors', () => {
  afterEach(() => {
    cleanup();
    mockPostChat.mockReset();
    sessionStorage.clear();
  });

  it('shows preview denied message when chat API returns workspace_bot_preview_access_denied', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE,
      errorCode: 'workspace_bot_preview_access_denied',
    });

    render(
      <MemoryRouter>
        <PlaygroundSection />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/type a test question/i), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(screen.getByText(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE)).toBeTruthy();
    });
  });

  it('shows credit limit copy when chat API returns plan_limit_ai_credits', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has used all AI credits for this billing period.',
      errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
    });

    render(
      <MemoryRouter>
        <PlaygroundSection />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/type a test question/i), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(screen.getByText(PLAN_LIMIT_AI_CREDITS_MESSAGE)).toBeTruthy();
      expect(screen.getByRole('link', { name: /view plans/i }).getAttribute('href')).toBe('/settings/plans');
    });
  });
});
