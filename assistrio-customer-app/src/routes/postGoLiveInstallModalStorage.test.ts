import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  POST_GO_LIVE_INSTALL_BOT_SESSION_KEY,
  POST_GO_LIVE_INSTALL_MODAL_INTENT_TTL_MS,
  POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY,
  botIdFromCustomerPathname,
  clearPostGoLiveInstallModalIntent,
  persistPostGoLiveInstallModalIntent,
  postGoLiveInstallIntentMatchesRoute,
  readPostGoLiveInstallModalIntent,
} from './postGoLiveInstallModalStorage';

describe('postGoLiveInstallModalStorage', () => {
  afterEach(() => {
    clearPostGoLiveInstallModalIntent();
    vi.useRealTimers();
  });

  it('persists and reads install modal intent', () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-123', createdAt: 1_000 });
    expect(readPostGoLiveInstallModalIntent(1_000)).toEqual({
      botId: 'bot-123',
      createdAt: 1_000,
    });
  });

  it('expires intent after ttl', () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-123', createdAt: 1_000 });
    expect(readPostGoLiveInstallModalIntent(1_000 + POST_GO_LIVE_INSTALL_MODAL_INTENT_TTL_MS + 1)).toBeNull();
  });

  it('migrates legacy bot-id session key', () => {
    sessionStorage.setItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY, 'legacy-bot');
    expect(readPostGoLiveInstallModalIntent()).toEqual(
      expect.objectContaining({ botId: 'legacy-bot' }),
    );
    expect(sessionStorage.getItem(POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY)).toBeTruthy();
  });

  it('matches bot detail and bots list routes', () => {
    const intent = { botId: 'abc', createdAt: Date.now() };
    expect(postGoLiveInstallIntentMatchesRoute(intent, '/bots/abc/playground/profile')).toBe(true);
    expect(postGoLiveInstallIntentMatchesRoute(intent, '/bots')).toBe(true);
    expect(postGoLiveInstallIntentMatchesRoute(intent, '/bots/other/playground')).toBe(false);
  });

  it('extracts bot id from pathname', () => {
    expect(botIdFromCustomerPathname('/bots/abc/playground')).toBe('abc');
    expect(botIdFromCustomerPathname('/bots')).toBeNull();
  });

  it('clears intent on close helper', () => {
    persistPostGoLiveInstallModalIntent({ botId: 'bot-123' });
    clearPostGoLiveInstallModalIntent();
    expect(readPostGoLiveInstallModalIntent()).toBeNull();
    expect(sessionStorage.getItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY)).toBeNull();
  });
});
