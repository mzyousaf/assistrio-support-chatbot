import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerBotListItem, CustomerMe } from '../api/types';
import { BotsListPage } from './BotsListPage';
import {
  BOTS_LIST_ADMIN_ONLY_CREATE_NOTE,
  BOTS_LIST_ADMIN_ONLY_CREATE_TOAST,
  BOTS_LIST_EMPTY_ADMIN_COPY,
  BOTS_LIST_EMPTY_MEMBER_COPY,
  BOTS_LIST_EMPTY_MEMBER_TITLE,
  BOTS_LIST_EMPTY_TITLE,
  BOTS_LIST_NO_ACTIVE_WORKSPACE,
} from '../lib/botsListMessages';

const mockGetBots = vi.fn();
const mockPostDraft = vi.fn();
const mockDeleteBot = vi.fn();
const mockNavigate = vi.fn();
const mockRefreshOnboarding = vi.fn();
const mockToastError = vi.fn();

vi.mock('../api/customerApi', () => ({
  getCustomerBots: (...args: unknown[]) => mockGetBots(...args),
  postCustomerBotDraft: (...args: unknown[]) => mockPostDraft(...args),
  deleteCustomerBot: (...args: unknown[]) => mockDeleteBot(...args),
}));

vi.mock('../lib/app-toast', () => ({
  appToast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockOpenUpgradeModal = vi.fn();

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({ openUpgradeModal: mockOpenUpgradeModal }),
}));

vi.mock('../components/AgentCard', () => ({
  AgentCard: ({
    bot,
    onReactivate,
  }: {
    bot: CustomerBotListItem;
    onReactivate?: (b: CustomerBotListItem) => void;
  }) => (
    <div data-testid={`agent-${bot._id}`} data-locked={bot.isOverLimitLocked ? 'true' : 'false'}>
      <span>{bot.name}</span>
      {bot.isOverLimitLocked ? (
        <button type="button" onClick={() => onReactivate?.(bot)}>
          Reactivate
        </button>
      ) : null}
    </div>
  ),
  DeleteAgentDialog: () => null,
}));

const adminCustomer: CustomerMe = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'customer',
  activeWorkspaceId: 'ws-1',
  workspaceIds: ['ws-1', 'ws-2'],
  workspaces: [
    {
      id: 'ws-1',
      name: 'Personal',
      role: 'admin',
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'free',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      onboardingStatus: 'completed',
    },
    {
      id: 'ws-2',
      name: 'Team',
      role: 'member',
      planKey: 'free',
      planName: 'Free',
      subscriptionStatus: 'free',
      botLimit: 1,
      memberLimit: 3,
      monthlyAiCredits: 50,
      kbStorageMbPerBot: 10,
      analyticsHistoryDays: 7,
      canExportReports: false,
      showPoweredByAssistrio: true,
      onboardingStatus: 'completed',
    },
  ],
};

const memberCustomer: CustomerMe = {
  ...adminCustomer,
  activeWorkspaceId: 'ws-2',
};

const sampleBot = (id: string, workspaceId: string): CustomerBotListItem => ({
  _id: id,
  name: `Agent ${id}`,
  agentsPackAgent: false,
  category: '',
  status: 'draft',
  isPublic: true,
  visibility: 'public',
  createdAt: null,
  slug: id,
  primaryColor: '#14B8A6',
  workspaceId,
});

let mockCustomer: CustomerMe | null = adminCustomer;

vi.mock('../auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    customer: mockCustomer,
    needsOnboarding: false,
    refreshOnboardingHeuristic: mockRefreshOnboarding,
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BotsListPage />
    </MemoryRouter>,
  );
}

describe('BotsListPage', () => {
  beforeEach(() => {
    mockCustomer = adminCustomer;
    mockGetBots.mockResolvedValue({ ok: true, data: [] });
    mockPostDraft.mockResolvedValue({ ok: true, data: { botId: 'new-bot', slug: 'new-bot' } });
    vi.stubGlobal('crypto', { randomUUID: () => 'draft-uuid-1' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('calls getCustomerBots with activeWorkspaceId', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
    });
  });

  it('refetches when activeWorkspaceId changes', async () => {
    const { rerender } = renderPage();
    await waitFor(() => expect(mockGetBots).toHaveBeenCalledTimes(1));

    mockCustomer = memberCustomer;
    rerender(
      <MemoryRouter>
        <BotsListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalledWith({ workspaceId: 'ws-2' });
    });
    expect(mockGetBots).toHaveBeenCalledTimes(2);
  });

  it('shows New AI Agent for workspace admin', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /New AI Agent/i })).toBeTruthy();
  });

  it('shows New AI Agent for workspace owner', async () => {
    mockCustomer = {
      ...adminCustomer,
      workspaces: adminCustomer.workspaces?.map((ws) =>
        ws.id === 'ws-1' ? { ...ws, role: 'owner' } : ws,
      ),
    };
    renderPage();
    expect(await screen.findByRole('button', { name: /New AI Agent/i })).toBeTruthy();
  });

  it('hides New AI Agent and shows admin-only note for members', async () => {
    mockCustomer = memberCustomer;
    renderPage();
    expect(await screen.findByText(BOTS_LIST_ADMIN_ONLY_CREATE_NOTE)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New AI Agent/i })).toBeNull();
  });

  it('shows admin empty state copy', async () => {
    renderPage();
    expect(await screen.findByText(BOTS_LIST_EMPTY_TITLE)).toBeTruthy();
    expect(screen.getByText(BOTS_LIST_EMPTY_ADMIN_COPY)).toBeTruthy();
  });

  it('shows member empty state copy without create button', async () => {
    mockCustomer = memberCustomer;
    renderPage();
    expect(await screen.findByText(BOTS_LIST_EMPTY_MEMBER_TITLE)).toBeTruthy();
    expect(screen.getByText(BOTS_LIST_EMPTY_MEMBER_COPY)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /New AI Agent/i })).toBeNull();
  });

  it('creates draft with active workspaceId and navigates', async () => {
    renderPage();
    const button = await screen.findByRole('button', { name: /New AI Agent/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPostDraft).toHaveBeenCalledWith({
        clientDraftId: 'draft-uuid-1',
        workspaceId: 'ws-1',
        name: 'AI Agent',
        description:
          'A helpful AI support agent that answers customer questions clearly and professionally.',
        category: 'Support',
        brandColor: '#14B8A6',
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/bots/new-bot');
    expect(mockRefreshOnboarding).toHaveBeenCalled();
  });

  it('opens upgrade modal when create hits plan bot limit', async () => {
    mockPostDraft.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Your workspace has reached the AI Agent limit for the current plan.',
      errorCode: 'plan_limit_workspace_bots',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New AI Agent/i }));

    await waitFor(() => {
      expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'bots' });
    });
  });

  it('shows Creating… while draft request is in flight', async () => {
    mockPostDraft.mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );
    renderPage();
    const [headerButton] = await screen.findAllByRole('button', { name: /New AI Agent/i });
    fireEvent.click(headerButton);
    const creatingButtons = await screen.findAllByRole('button', { name: /Creating…/i });
    expect(creatingButtons.length).toBeGreaterThan(0);
    expect(creatingButtons.every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('shows toast when create returns workspace_access_denied', async () => {
    mockPostDraft.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Forbidden',
      errorCode: 'workspace_access_denied',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /New AI Agent/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(BOTS_LIST_ADMIN_ONLY_CREATE_TOAST);
    });
  });

  it('does not render bot cards when member has no granted bots', async () => {
    mockCustomer = memberCustomer;
    mockGetBots.mockResolvedValue({ ok: true, data: [] });
    renderPage();
    await waitFor(() => expect(mockGetBots).toHaveBeenCalled());
    expect(screen.queryByTestId(/^agent-/)).toBeNull();
  });

  it('renders only bots returned by grant-filtered list API', async () => {
    mockCustomer = memberCustomer;
    mockGetBots.mockResolvedValue({
      ok: true,
      data: [sampleBot('bot-visible', 'ws-2')],
    });
    renderPage();
    expect(await screen.findByTestId('agent-bot-visible')).toBeTruthy();
    expect(screen.queryByTestId('agent-bot-hidden')).toBeNull();
  });

  it('hides delete menu for members on bot cards', async () => {
    mockCustomer = memberCustomer;
    mockGetBots.mockResolvedValue({
      ok: true,
      data: [sampleBot('bot-1', 'ws-2')],
    });
    renderPage();
    expect(await screen.findByTestId('agent-bot-1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
  });

  it('shows no active workspace state', async () => {
    mockCustomer = { ...adminCustomer, activeWorkspaceId: null, workspaces: [] };
    renderPage();
    expect(await screen.findByText(BOTS_LIST_NO_ACTIVE_WORKSPACE)).toBeTruthy();
    expect(mockGetBots).not.toHaveBeenCalled();
  });

  it('shows agent count tag with current and plan limit', async () => {
    mockGetBots.mockResolvedValue({
      ok: true,
      data: [sampleBot('bot-1', 'ws-1')],
    });
    renderPage();
    expect(await screen.findByLabelText('1 of 1 agents used')).toBeTruthy();
    expect(screen.getByText('1/1')).toBeTruthy();
  });

  it('shows loading skeleton in agent count tag while fetching', async () => {
    mockGetBots.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading agent count')).toBeTruthy();
    expect(screen.queryByText('…/1')).toBeNull();
  });

  it('shows loading skeleton while fetching agents', async () => {
    mockGetBots.mockImplementation(
      () => new Promise(() => {
        /* never resolves */
      }),
    );
    renderPage();
    expect(await screen.findByLabelText('Loading agents')).toBeTruthy();
  });

  it('does not show previous workspace bots while loading after switch', async () => {
    mockGetBots.mockImplementation(async (params?: { workspaceId?: string }) => {
      if (params?.workspaceId === 'ws-1') {
        return { ok: true, data: [sampleBot('bot-ws1', 'ws-1')] };
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { ok: true, data: [sampleBot('bot-ws2', 'ws-2')] };
    });

    const { rerender } = renderPage();
    expect(await screen.findByTestId('agent-bot-ws1')).toBeTruthy();

    mockCustomer = memberCustomer;
    rerender(
      <MemoryRouter>
        <BotsListPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('agent-bot-ws1')).toBeNull();
    expect(await screen.findByTestId('agent-bot-ws2')).toBeTruthy();
  });

  it('opens upgrade modal when Reactivate is clicked on locked bot card', async () => {
    mockGetBots.mockResolvedValue({
      ok: true,
      data: [
        {
          ...sampleBot('bot-locked', 'ws-1'),
          isOverLimitLocked: true,
          lockedReason: 'workspace_bot_limit_exceeded',
          lockedMessage: 'Workspace agent limit exceeded',
        },
      ],
    });

    renderPage();
    expect((await screen.findByTestId('agent-bot-locked')).getAttribute('data-locked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /reactivate/i }));
    expect(mockOpenUpgradeModal).toHaveBeenCalledWith({ reason: 'bots' });
  });
});
