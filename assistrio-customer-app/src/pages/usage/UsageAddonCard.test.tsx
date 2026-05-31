import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageAddonCard } from './UsageAddonCard';

describe('UsageAddonCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls onPurchase for paid-plan add-on when checkout is available', () => {
    const onPurchase = vi.fn();
    render(
      <UsageAddonCard
        addon={{
          key: 'extra_bot',
          name: 'Extra bot',
          billingInterval: 'monthly',
          priceUsd: 49,
          scope: 'workspace',
          checkoutAvailable: true,
        }}
        currentPlanKey="starter"
        isOwner
        addonsAllowed
        onPurchase={onPurchase}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onPurchase).toHaveBeenCalledTimes(1);
  });

  it('shows paid-plan copy on free trial without purchase button', () => {
    render(
      <UsageAddonCard
        addon={{
          key: 'extra_bot',
          name: 'Extra bot',
          billingInterval: 'monthly',
          priceUsd: 49,
          scope: 'workspace',
          checkoutAvailable: true,
        }}
        currentPlanKey="free"
        isOwner
        addonsAllowed={false}
      />,
    );

    expect(screen.getByText('Available on paid plans.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
  });
});
