import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeadsHeader } from './LeadsHeader';
import { EXPORT_REPORTS_LOCKED_HELPER } from '@/lib/analyticsEntitlementCopy';

describe('LeadsHeader export entitlement', () => {
  afterEach(() => cleanup());

  it('shows locked export helper and View plans link when exportLocked', () => {
    render(
      <MemoryRouter>
        <LeadsHeader
          exportLocked
          exportDisabled={false}
          onExport={vi.fn()}
          refreshDisabled={false}
          refreshLoading={false}
          onRefresh={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(EXPORT_REPORTS_LOCKED_HELPER, { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: /view plans/i }).getAttribute('href')).toBe('/settings/plans');
    expect(screen.getByRole('button', { name: /export csv/i }).hasAttribute('disabled')).toBe(true);
  });
});
