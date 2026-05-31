import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlaygroundSection } from './PlaygroundSection';
import { WORKSPACE_BOT_PREVIEW_ACCESS_DENIED_MESSAGE } from '@/lib/botsListMessages';
import {
  PLAN_LIMIT_AI_CREDITS_CODE,
  PLAN_LIMIT_AI_CREDITS_MEMBER_MESSAGE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
  WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
} from '@/lib/planLimitError';

const mockPostChat = vi.fn();
const mockOpenUpgradeModal = vi.fn();
const mockOpenTopUpPromptModal = vi.fn();
let mockRole: 'owner' | 'admin' | 'member' = 'owner';

vi.mock('../../api/customerApi', () => ({
  postCustomerBotChat: (...args: unknown[]) => mockPostChat(...args),
}));

vi.mock('../../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: {
      workspaces: [{ id: 'ws-1', role: mockRole, name: 'Test' }],
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

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({
    openUpgradeModal: mockOpenUpgradeModal,
    openTopUpPromptModal: mockOpenTopUpPromptModal,
    closeUpgradeModal: vi.fn(),
    closeTopUpPromptModal: vi.fn(),
  }),
}));

describe('PlaygroundSection chat errors', () => {
  afterEach(() => {
    cleanup();
    mockPostChat.mockReset();
    mockOpenUpgradeModal.mockReset();
    mockOpenTopUpPromptModal.mockReset();
    mockRole = 'owner';
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

  it('shows inactive-agent copy when chat API returns workspace_bot_limit_exceeded', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE,
      errorCode: WORKSPACE_BOT_LIMIT_EXCEEDED_CODE,
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
      expect(screen.getByText(WORKSPACE_BOT_LIMIT_EXCEEDED_MESSAGE)).toBeTruthy();
    });
  });

  it('opens top-up prompt for owner when auto-prompt metadata is present', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has used all AI credits for this billing period.',
      errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
      body: { canAutoTopUpPrompt: true, topUpCheckoutAvailable: true },
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
      expect(mockOpenTopUpPromptModal).toHaveBeenCalled();
      expect(mockOpenUpgradeModal).not.toHaveBeenCalled();
    });
  });

  it('opens upgrade modal when credits exhausted without auto-prompt', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has used all AI credits for this billing period.',
      errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
      body: { canAutoTopUpPrompt: false },
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
      expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ errorCode: PLAN_LIMIT_AI_CREDITS_CODE });
      expect(mockOpenTopUpPromptModal).not.toHaveBeenCalled();
    });
  });

  it('shows credit limit copy when chat API returns plan_limit_ai_credits', async () => {
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has used all AI credits for this billing period.',
      errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
      body: { canAutoTopUpPrompt: false },
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
      expect(screen.getByText(/Your workspace has used all AI credits for this billing period/i)).toBeTruthy();
      expect(screen.getByRole('link', { name: /view plans/i }).getAttribute('href')).toBe('/settings/billing');
    });
  });

  it('does not open top-up prompt for members', async () => {
    mockRole = 'member';
    mockPostChat.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has used all AI credits for this billing period.',
      errorCode: PLAN_LIMIT_AI_CREDITS_CODE,
      body: { canAutoTopUpPrompt: true },
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
      expect(screen.getByText(PLAN_LIMIT_AI_CREDITS_MEMBER_MESSAGE)).toBeTruthy();
      expect(mockOpenTopUpPromptModal).not.toHaveBeenCalled();
    });
  });
});
