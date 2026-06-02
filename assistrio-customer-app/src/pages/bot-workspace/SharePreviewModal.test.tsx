import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharePreviewModal } from '@/pages/bot-workspace/SharePreviewModal';

vi.mock('@/api/customerApi', () => ({
  getCustomerBotShareLink: vi.fn(async () => ({
    ok: true,
    data: {
      enabled: false,
      slug: '',
      status: 'not_created',
      requiresPreviewToken: true,
      secureSharePreviewConfigured: false,
    },
  })),
  enableSharePreview: vi.fn(),
  disableSharePreview: vi.fn(),
  patchSharePreviewEnabled: vi.fn(),
  regenerateSharePreviewToken: vi.fn(),
  revokeSharePreview: vi.fn(),
}));

vi.mock('@/components/billing/UpgradePlanModalProvider', () => ({
  useUpgradePlanModal: () => ({ openUpgradeModal: vi.fn() }),
}));

describe('SharePreviewModal', () => {
  afterEach(() => cleanup());

  it('shows paid-plan callout and disables create on free trial', async () => {
    render(
      <SharePreviewModal
        open
        onClose={() => {}}
        botId="bot-1"
        bot={null}
        agentStatus="draft"
        sharePreviewAllowed={false}
        onRefresh={async () => {}}
      />,
    );

    expect(await screen.findByText('Share preview links are available on paid plans.')).toBeTruthy();
    const createButton = await screen.findByRole('button', { name: /create secure preview link/i });
    expect(createButton.hasAttribute('disabled')).toBe(true);
  });

  it('allows create controls on paid plans', async () => {
    render(
      <SharePreviewModal
        open
        onClose={() => {}}
        botId="bot-1"
        bot={null}
        agentStatus="draft"
        sharePreviewAllowed
        onRefresh={async () => {}}
      />,
    );

    const createButton = await screen.findByRole('button', { name: /create secure preview link/i });
    expect(createButton.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText('Share preview links are available on paid plans.')).toBeNull();
  });
});
