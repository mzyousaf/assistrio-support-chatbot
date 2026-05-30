import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpgradePlanModal } from './UpgradePlanModal';
import { resolveUpgradePlanReasonSubtitle } from '@/lib/planLimitError';

const onPlanCheckout = vi.fn();

const planCatalog = [
  {
    key: 'free',
    name: 'Free',
    priceMonthly: 0,
    botLimit: 1,
    memberLimit: 1,
    monthlyAiCredits: 50,
    kbStorageMbPerBot: 5,
    analyticsHistoryDays: 7,
    canExportReports: false,
    checkoutAvailable: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 49,
    botLimit: 3,
    memberLimit: 5,
    monthlyAiCredits: 500,
    kbStorageMbPerBot: 15,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 99,
    botLimit: 10,
    memberLimit: 10,
    monthlyAiCredits: 2000,
    kbStorageMbPerBot: 30,
    analyticsHistoryDays: null,
    canExportReports: true,
    checkoutAvailable: true,
  },
];

describe('UpgradePlanModal', () => {
  afterEach(() => {
    cleanup();
    onPlanCheckout.mockReset();
  });

  it('renders Starter and Pro using Plans page card content', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="credits"
        currentPlanKey="free"
        planCatalog={planCatalog}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '7-day free trial' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Why Starter?', level: 4 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why Pro?', level: 4 })).toBeTruthy();
    expect(screen.getByText('10x more AI credits than Free')).toBeTruthy();
    expect(screen.getByText('2,000 AI credits/month')).toBeTruthy();
  });

  it('does not render Free plan card', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="members"
        currentPlanKey="free"
        planCatalog={planCatalog}
      />,
    );

    expect(screen.queryByRole('heading', { name: 'Why Free?', level: 4 })).toBeNull();
    expect(screen.queryByText('Test your first AI agent')).toBeNull();
  });

  it('changes subtitle by reason', () => {
    const { rerender } = render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="members"
        currentPlanKey="free"
        planCatalog={planCatalog}
      />,
    );

    expect(screen.getByText(resolveUpgradePlanReasonSubtitle('members'))).toBeTruthy();

    rerender(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="export"
        currentPlanKey="free"
        planCatalog={planCatalog}
      />,
    );

    expect(screen.getByText(resolveUpgradePlanReasonSubtitle('export'))).toBeTruthy();
  });

  it('shows current plan badge on Starter when workspace is on Starter', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="export"
        currentPlanKey="starter"
        planCatalog={planCatalog}
      />,
    );

    expect(screen.getByRole('button', { name: 'Current plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
  });

  it('uses checkout actions for owner on free trial when checkout is enabled', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="credits"
        currentPlanKey="free"
        planCatalog={planCatalog}
        recommendedPlanKey="pro"
        canUpgrade
        isTrialPlan
        onPlanCheckout={onPlanCheckout}
      />,
    );

    expect(screen.getByRole('button', { name: 'Upgrade to Starter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));
    expect(onPlanCheckout).toHaveBeenCalledWith('pro');
  });

  it('shows disabled coming soon when checkout is not configured', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="credits"
        currentPlanKey="free"
        planCatalog={planCatalog.map((p) => ({ ...p, checkoutAvailable: false }))}
        recommendedPlanKey="pro"
        canUpgrade
      />,
    );

    const comingSoonButtons = screen.getAllByRole('button', { name: 'Coming soon' });
    expect(comingSoonButtons).toHaveLength(2);
    expect(screen.getByText('Checkout is not enabled yet.')).toBeTruthy();
  });

  it('shows owner-only note for non-owner viewers', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="credits"
        currentPlanKey="free"
        planCatalog={planCatalog}
        canUpgrade={false}
      />,
    );

    expect(screen.getByText('Only the workspace owner can upgrade this workspace.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Coming soon' })).toHaveLength(2);
  });

  it('non-owner sees disabled billing actions', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="credits"
        currentPlanKey="free"
        planCatalog={planCatalog}
        canUpgrade={false}
        isTrialPlan
      />,
    );
    expect(screen.getAllByRole('button', { name: 'Coming soon' }).length).toBeGreaterThanOrEqual(2);
  });

  it('uses fallback catalog when planCatalog is missing', () => {
    render(
      <UpgradePlanModal
        open
        onClose={() => undefined}
        reason="members"
        currentPlanKey="free"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Starter' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pro' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why Starter?', level: 4 })).toBeTruthy();
  });
});
