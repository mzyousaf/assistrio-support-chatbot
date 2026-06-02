import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { formatSharePreviewUserMessage, SharedChatPage } from '@/pages/public/SharedChatPage';
import { PLAN_LIMIT_SHARE_PREVIEW_CODE } from '@/lib/planLimitError';
import type { SharedBotInitPayload } from '@/api/types';

const getSharedBotInitMock = vi.fn();
const adminLiveChatAdapterMock = vi.fn((_props: Record<string, unknown>) => (
  <div data-testid="chat-adapter" />
));
const customerAuthMock = vi.fn(() => ({ status: 'anonymous' as const }));

vi.mock('@/api/customerApi', () => ({
  getSharedBotInit: (...args: unknown[]) => getSharedBotInitMock(...args),
}));

vi.mock('@/api/client', () => ({
  getCustomerApiOrigin: () => 'https://api.example.com',
  customerGoogleAuthStartUrl: () => 'https://api.example.com/api/customer/auth/google',
}));

vi.mock('@/auth/CustomerAuthContext', () => ({
  useCustomerAuth: () => customerAuthMock(),
}));

vi.mock('@assistrio/chat-widget', () => ({
  AdminLiveChatAdapter: (props: Record<string, unknown>) => adminLiveChatAdapterMock(props),
  ClampedTextWithSeeMore: ({ text, seeMoreLabel }: { text: string; seeMoreLabel?: string }) => (
    <div data-testid="clamped-text">{text}{seeMoreLabel ? ` ${seeMoreLabel}` : ''}</div>
  ),
}));

function mockInitPayload(overrides: Partial<SharedBotInitPayload['bot']> = {}): SharedBotInitPayload {
  return {
    status: 'ok',
    shareSlug: 'sc-demo',
    bot: {
      id: 'bot-123',
      name: 'Support Bot',
      description: 'Answers product questions.',
      welcomeMessage: 'Hello!',
      ...overrides,
    },
    settings: {
      chatUI: {},
      visitorMultiChatEnabled: false,
      visitorMultiChatMax: null,
    },
    chatVisitorId: 'visitor-abc',
  };
}

function renderSharePage(path = '/share/sc-demo?shareToken=test-token-123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/share/:slug" element={<SharedChatPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('formatSharePreviewUserMessage', () => {
  it('maps plan_limit_share_preview to inactive preview message', () => {
    expect(
      formatSharePreviewUserMessage('Share preview links are available on paid plans.', PLAN_LIMIT_SHARE_PREVIEW_CODE),
    ).toBe('This preview link is no longer active. Please contact the workspace owner.');
  });
});

describe('SharedChatPage', () => {
  beforeEach(() => {
    getSharedBotInitMock.mockReset();
    adminLiveChatAdapterMock.mockClear();
    customerAuthMock.mockReturnValue({ status: 'anonymous' });
    vi.stubGlobal(
      'localStorage',
      {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      } as unknown as Storage,
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders loading state', () => {
    getSharedBotInitMock.mockReturnValue(new Promise(() => {}));
    renderSharePage();
    expect(screen.getByRole('status', { name: /loading share preview/i })).toBeTruthy();
    expect(screen.getByText(/loading preview/i)).toBeTruthy();
  });

  it('renders invalid token error', async () => {
    getSharedBotInitMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Invalid share token',
      body: { error: 'Invalid share token', errorCode: 'SHARE_TOKEN_INVALID' },
    });
    renderSharePage();
    expect(await screen.findByText(/preview link unavailable/i)).toBeTruthy();
    expect(
      screen.getByText(/missing a valid security token or the token no longer matches/i),
    ).toBeTruthy();
  });

  it('renders expired link error', async () => {
    getSharedBotInitMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Share preview has expired',
      body: { error: 'Share preview has expired', errorCode: 'SHARE_PREVIEW_EXPIRED' },
    });
    renderSharePage();
    expect(await screen.findByText(/has expired/i)).toBeTruthy();
  });

  it('renders disabled link error', async () => {
    getSharedBotInitMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Share preview is disabled',
      body: { error: 'Share preview is disabled', errorCode: 'SHARE_PREVIEW_DISABLED' },
    });
    renderSharePage();
    expect(await screen.findByText(/turned off for this agent/i)).toBeTruthy();
  });

  it('renders plan-limit error', async () => {
    getSharedBotInitMock.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Share preview links are available on paid plans.',
      errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE,
      body: {
        message: 'Share preview links are available on paid plans.',
        errorCode: PLAN_LIMIT_SHARE_PREVIEW_CODE,
      },
    });
    renderSharePage();
    expect(await screen.findByText(/no longer active/i)).toBeTruthy();
  });

  it('renders ready layout with agent name and labels inside the website canvas', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    expect(await screen.findByText(/chat with/i)).toBeTruthy();
    expect(screen.getByText('Support Bot')).toBeTruthy();
    expect(screen.getByText('Shared agent preview')).toBeTruthy();
    expect(screen.getByText('Live widget preview')).toBeTruthy();
    expect(
      screen.getByText(/interact with this agent like it is installed on a website/i),
    ).toBeTruthy();
    expect(document.querySelector('[data-share-preview-page-shell]')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-ready-layout]')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-widget-stage]')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-website-canvas]')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-website-backdrop]')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-chat-card]')).toBeNull();
  });

  it('renders full website page content below browser chrome inside the measure host', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const stage = await waitFor(() => {
      const el = document.querySelector('[data-share-preview-widget-stage]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });

    expect(within(stage).getByText('your-website.com')).toBeTruthy();

    const measureHost = stage.querySelector('[data-share-preview-measure-host]') as HTMLElement;
    expect(measureHost).toBeTruthy();

    const hero = measureHost.querySelector('[data-share-preview-website-hero]') as HTMLElement;
    expect(hero).toBeTruthy();
    expect(within(hero).getByText(/chat with/i)).toBeTruthy();
    expect(within(hero).getByText('Shared agent preview')).toBeTruthy();
    expect(within(hero).getByText('Knowledge-based answers')).toBeTruthy();
    expect(within(hero).getByText('Create your own Free AI support agent')).toBeTruthy();
    expect(within(hero).getByRole('link', { name: /continue with google/i })).toBeTruthy();
    expect(within(hero).queryByText('Live widget preview')).toBeNull();
    expect(within(hero).queryByText('Powered by Assistrio')).toBeNull();

    const footer = measureHost.querySelector('[data-share-preview-website-footer]') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(within(footer).getByText('Live widget preview')).toBeTruthy();
    expect(within(footer).getByText('Powered by Assistrio')).toBeTruthy();
    expect(document.querySelector('[data-share-preview-brand-column]')).toBeNull();
    expect(document.querySelector('[data-share-preview-brand-mobile]')).toBeNull();
  });

  it('renders website preview canvas with measure host below intro', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const stage = await waitFor(() => {
      const el = document.querySelector('[data-share-preview-widget-stage]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });

    expect(stage.className).toMatch(/h-full/);
    expect(stage.className).toMatch(/w-full/);
    expect(stage.className).not.toMatch(/rounded-/);

    const measureHost = stage.querySelector('[data-widget-preview-measure]');
    expect(measureHost).toBeTruthy();
    expect(measureHost?.className).toMatch(/flex-1/);
    expect(measureHost?.querySelector('[data-share-preview-website-backdrop]')).toBeTruthy();
    expect(measureHost?.querySelector('[data-testid="chat-adapter"]')).toBeTruthy();
  });

  it('passes live-widget stage props to AdminLiveChatAdapter without fillParent or keys', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage('/share/sc-demo?shareToken=secret-preview-token');

    await waitFor(() => {
      expect(adminLiveChatAdapterMock).toHaveBeenCalled();
    });

    const props = adminLiveChatAdapterMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props.runtimeSurface).toBe('shared');
    expect(props.sharePreviewToken).toBe('secret-preview-token');
    expect(props.sharedSlug).toBe('sc-demo');
    expect(props.stageMode).toBe('live-widget');
    expect(props.containedStage).toBe(true);
    expect(props.defaultOpen).toBe(true);
    expect(props.inlinePanelCollapsedWidth).toBe(404);
    expect(props.inlinePanelCollapsedHeight).toBe(720);
    expect(props.inlinePanelExpandedWidth).toBe(620);
    expect(props.inlinePanelExpandedHeight).toBeUndefined();
    expect(props.fillParent).toBeUndefined();
    expect(props.surfaceVariant).toBeUndefined();
    expect(props.accessKey).toBeUndefined();
    expect(props.secretKey).toBeUndefined();
    expect(props.mode).toBe('runtime');
  });

  it('calls init with slug and share token', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage('/share/sc-demo?shareToken=abc123');

    await waitFor(() => {
      expect(getSharedBotInitMock).toHaveBeenCalledWith('sc-demo', undefined, 'abc123');
    });
  });

  it('uses edge-to-edge preview column without outer padding', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const layout = await screen.findByTestId('share-preview-ready-layout');
    expect(layout.className).not.toMatch(/\bpx-/);
    expect(layout.className).not.toMatch(/\bpy-/);
    expect(layout.className).toMatch(/h-full/);
    expect(layout.className).toMatch(/w-full/);
    expect(layout.className).toMatch(/min-w-0/);
    expect(layout.className).toMatch(/flex-1/);

    const previewColumn = document.querySelector('[data-share-preview-live-widget-column]') as HTMLElement;
    expect(previewColumn).toBeTruthy();
    expect(previewColumn.className).toMatch(/w-full/);
  });

  it('avoids horizontal overflow on mobile-ready layout shell', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    await screen.findByText(/chat with/i);
    const shell = document.querySelector('[data-share-preview-page-shell]') as HTMLElement;
    expect(shell).toBeTruthy();
    expect(shell.className).toMatch(/overflow-x-hidden/);
    expect(shell.className).toMatch(/h-dvh/);
    expect(shell.className).toMatch(/min-w-0/);
    expect(shell.className).not.toMatch(/\bp-6\b/);
    expect(shell.className).not.toMatch(/\bp-5\b/);
  });

  it('shows Continue with Google when the visitor is not signed in', async () => {
    customerAuthMock.mockReturnValue({ status: 'anonymous' });
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const hero = await waitFor(() => {
      const el = document.querySelector('[data-share-preview-website-hero]') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });

    const googleLink = within(hero).getByRole('link', { name: /continue with google/i });
    expect(googleLink.getAttribute('href')).toBe('https://api.example.com/api/customer/auth/google');
    expect(googleLink.className).toMatch(/color-teal-600/);
    expect(googleLink.className).toMatch(/\bw-fit\b/);
    expect(googleLink.querySelector('svg')).toBeTruthy();
  });

  it('hides create-agent CTA when the visitor is already signed in', async () => {
    customerAuthMock.mockReturnValue({ status: 'authenticated' });
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const hero = await waitFor(() => {
      const el = document.querySelector('[data-share-preview-website-hero]') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });

    expect(within(hero).queryByText('Create your own Free AI support agent')).toBeNull();
    expect(within(hero).queryByRole('link', { name: /continue with google/i })).toBeNull();
    expect(document.querySelector('[data-share-preview-create-agent-cta]')).toBeNull();
  });

  it('renders live preview label and powered-by at bottom center of the canvas', async () => {
    getSharedBotInitMock.mockResolvedValue({ ok: true, data: mockInitPayload() });
    renderSharePage();

    const footer = await waitFor(() => {
      const el = document.querySelector('[data-share-preview-website-footer]') as HTMLElement;
      expect(el).toBeTruthy();
      return el;
    });

    expect(footer.className).toMatch(/\bbottom-0\b/);
    expect(footer.className).toMatch(/\binset-x-0\b/);
    expect(within(footer).getByText('Live widget preview')).toBeTruthy();
    expect(
      within(footer).getByText(/interact with this agent like it is installed on a website/i),
    ).toBeTruthy();
    expect(within(footer).getByText('Powered by Assistrio')).toBeTruthy();
    expect(within(footer).queryByText('Knowledge-based answers')).toBeNull();
  });
});
