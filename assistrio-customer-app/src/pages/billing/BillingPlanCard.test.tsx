import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingPlanCard } from './BillingPlanCard';

const starterPlan = {
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
};

describe('BillingPlanCard', () => {
  afterEach(() => cleanup());

  it('shows current plan action when isCurrent', () => {
    render(<BillingPlanCard plan={starterPlan} isCurrent actionLabel="Current plan" actionDisabled />);

    expect(screen.getByRole('button', { name: 'Current plan' })).toBeTruthy();
  });

  it('shows enabled upgrade action when checkout is available', () => {
    const onAction = vi.fn();
    render(
      <BillingPlanCard
        plan={starterPlan}
        isCurrent={false}
        actionLabel="Upgrade to Starter"
        actionDisabled={false}
        onAction={onAction}
      />,
    );

    const button = screen.getByRole('button', { name: 'Upgrade to Starter' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('shows coming soon when disabled', () => {
    render(
      <BillingPlanCard plan={starterPlan} isCurrent={false} actionLabel="Coming soon" actionDisabled />,
    );

    expect((screen.getByRole('button', { name: 'Coming soon' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows current plan corner tag and days left button in modal', () => {
    render(
      <BillingPlanCard
        plan={starterPlan}
        isCurrent
        variant="modal"
        modalDaysLeftButtonLabel="12 Days Left"
        actionLabel="Current plan"
        actionDisabled
      />,
    );

    expect(screen.getByText('Current plan')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: '12 Days Left' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Current plan' })).toBeNull();
  });

  it('shows expires-on date button in modal for non-current trial free card', () => {
    render(
      <BillingPlanCard
        plan={{ ...starterPlan, key: 'free', name: 'Free', priceMonthly: 0 }}
        isCurrent={false}
        variant="modal"
        modalExpiresOnButtonLabel="Expires on Jun 1, 2026"
        actionLabel="Coming soon"
        actionDisabled
      />,
    );

    expect(
      (screen.getByRole('button', { name: 'Expires on Jun 1, 2026' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
