import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundSection } from './PlaygroundSection';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from '@/lib/botsListMessages';

const mockPostChat = vi.fn();

vi.mock('../../api/customerApi', () => ({
  postCustomerBotChat: (...args: unknown[]) => mockPostChat(...args),
}));

vi.mock('./BotWorkspaceContext', () => ({
  useBotWorkspace: () => ({
    bot: { id: 'bot-1', status: 'published', name: 'Test' },
    botId: 'bot-1',
  }),
}));

describe('PlaygroundSection preview access errors', () => {
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

    render(<PlaygroundSection />);

    fireEvent.change(screen.getByPlaceholderText(/type a test question/i), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(screen.getByText(WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE)).toBeTruthy();
    });
  });
});
