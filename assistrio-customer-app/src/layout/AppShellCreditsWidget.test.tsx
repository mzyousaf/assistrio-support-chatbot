import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import type { ComponentProps } from 'react';
import { AppShellCreditsWidget } from '@/layout/AppShellCreditsWidget';

function renderWidget(
  props: Partial<ComponentProps<typeof AppShellCreditsWidget>> = {},
) {
  return render(
    <MemoryRouter>
      <AppShellCreditsWidget
        variant="card"
        activeWorkspaceId="ws-1"
        loadState="ready"
        aiCredits={{
          periodStart: '',
          periodEnd: '',
          monthlyCredits: 50,
          monthlyCreditsUsed: 12,
          monthlyCreditsRemaining: 38,
          topUpCreditsRemaining: 0,
          totalCreditsAvailable: 50,
          totalCreditsRemaining: 38,
          isOverLimit: false,
          byBot: [],
        }}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('AppShellCreditsWidget', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders real credits from billing summary', () => {
    renderWidget();
    expect(screen.getByText('12 / 50 monthly used')).toBeTruthy();
    expect(screen.getByText('38 total remaining')).toBeTruthy();
  });

  it('shows loading state', () => {
    renderWidget({ loadState: 'loading', aiCredits: undefined });
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows error state', () => {
    renderWidget({ loadState: 'error', aiCredits: undefined });
    expect(screen.getByText('Usage unavailable')).toBeTruthy();
  });

  it('hides widget when there is no active workspace', () => {
    const { container } = renderWidget({ activeWorkspaceId: null });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows over-limit warning state', () => {
    renderWidget({
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 50,
        monthlyCreditsUsed: 55,
        monthlyCreditsRemaining: 0,
        topUpCreditsRemaining: 0,
        totalCreditsAvailable: 50,
        totalCreditsRemaining: 0,
        isOverLimit: true,
        byBot: [],
      },
    });
    expect(screen.getByText('55 / 50 monthly used')).toBeTruthy();
    expect(screen.getByText('Over monthly limit')).toBeTruthy();
  });

  it('shows top-up credits available in sidebar widget', () => {
    renderWidget({
      aiCredits: {
        periodStart: '',
        periodEnd: '',
        monthlyCredits: 500,
        monthlyCreditsUsed: 12,
        monthlyCreditsRemaining: 488,
        topUpCreditsRemaining: 1000,
        totalCreditsAvailable: 1500,
        totalCreditsRemaining: 1488,
        isOverLimit: false,
        byBot: [],
      },
    });
    expect(screen.getByText('1,000 top-up credits available')).toBeTruthy();
  });
});
