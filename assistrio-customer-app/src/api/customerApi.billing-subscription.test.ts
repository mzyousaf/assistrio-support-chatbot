import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelWorkspaceSubscription } from './customerApi';

const mockFetch = vi.fn();

describe('cancelWorkspaceSubscription', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          message: 'Subscription cancellation scheduled.',
          summary: { workspaceId: 'ws-1' },
        }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('POSTs JSON body with confirm true and Content-Type application/json', async () => {
    await cancelWorkspaceSubscription('ws-1', { confirm: true });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/customer/workspaces/ws-1/billing/subscription/cancel');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ confirm: true }));
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});
