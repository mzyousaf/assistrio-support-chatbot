import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PostGoLiveInstallModalHost } from './PostGoLiveInstallModalHost';
import {
  clearPostGoLiveInstallModalIntent,
  persistPostGoLiveInstallModalIntent,
} from '@/routes/postGoLiveInstallModalStorage';

const modalProps = vi.hoisted(() => ({
  open: false,
  botId: null as string | null,
  onClose: () => {},
}));

vi.mock('./YouAreLiveModal', () => ({
  YouAreLiveModal: (props: { open: boolean; botId: string | null; onClose: () => void }) => {
    modalProps.open = props.open;
    modalProps.botId = props.botId;
    modalProps.onClose = props.onClose;
    return props.open ? <div data-testid="you-are-live-modal">{props.botId}</div> : null;
  },
}));

vi.mock('@/onboarding/goLivePublishOverlay', () => ({
  useGoLivePublishOverlay: () => ({ clearPublishSuccessOverlay: vi.fn() }),
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderHost(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/bots/:id/playground/profile"
          element={
            <>
              <LocationDisplay />
              <PostGoLiveInstallModalHost />
            </>
          }
        />
        <Route
          path="/bots"
          element={
            <>
              <LocationDisplay />
              <PostGoLiveInstallModalHost />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PostGoLiveInstallModalHost', () => {
  afterEach(() => {
    cleanup();
    clearPostGoLiveInstallModalIntent();
    modalProps.open = false;
    modalProps.botId = null;
    vi.clearAllMocks();
  });

  it('opens from URL params on bot detail child route', () => {
    renderHost('/bots/bot-1/playground/profile?showInstall=1&liveBotId=bot-1');
    expect(modalProps.open).toBe(true);
    expect(modalProps.botId).toBe('bot-1');
  });

  it('opens from sessionStorage when query params were dropped', async () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-1', createdAt: Date.now() });
    const view = renderHost('/bots/bot-1/playground/profile');

    await waitFor(() => {
      expect(modalProps.open).toBe(true);
    });
    expect(modalProps.botId).toBe('bot-1');
    expect(view.getByTestId('location').textContent).toContain('showInstall=1');
    expect(view.getByTestId('location').textContent).toContain('liveBotId=bot-1');
  });

  it('opens from sessionStorage on bots list fallback route', async () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-1', createdAt: Date.now() });
    renderHost('/bots');

    await waitFor(() => {
      expect(modalProps.open).toBe(true);
    });
    expect(modalProps.botId).toBe('bot-1');
  });

  it('clears query params and sessionStorage when modal closes', async () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-1', createdAt: Date.now() });
    const view = renderHost('/bots/bot-1/playground/profile?showInstall=1&liveBotId=bot-1');

    await waitFor(() => expect(modalProps.open).toBe(true));
    modalProps.onClose();

    await waitFor(() => {
      expect(view.getByTestId('location').textContent).toBe('/bots/bot-1/playground/profile');
    });
    expect(modalProps.open).toBe(false);
  });
});
