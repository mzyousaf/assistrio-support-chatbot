import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SETTINGS_NAV_ITEMS,
  normalizeSettingsPathname,
  resolveSettingsNavActiveIndex,
} from '@/lib/settingsNavigation';

describe('settingsNavigation', () => {
  afterEach(() => cleanup());

  it('lists General settings pages in sidebar order', () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.label)).toEqual([
      'General',
      'Members',
      'Plans',
      'Billing',
    ]);
  });

  it('maps legacy account routes to Workspace active index', () => {
    expect(normalizeSettingsPathname('/settings/general')).toBe('/settings/workspace');
    expect(normalizeSettingsPathname('/settings/account')).toBe('/settings/workspace');
    expect(resolveSettingsNavActiveIndex('/settings/account')).toBe(0);
  });

  it('resolves active nav index for workspace route', () => {
    expect(resolveSettingsNavActiveIndex('/settings/workspace')).toBe(0);
    expect(resolveSettingsNavActiveIndex('/settings/members')).toBe(1);
  });
});

describe('settings routes', () => {
  afterEach(() => cleanup());

  it('redirects /settings/account to /settings/workspace', () => {
    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <Routes>
          <Route path="/settings/account" element={<Navigate to="/settings/workspace" replace />} />
          <Route path="/settings/workspace" element={<div>Workspace settings page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Workspace settings page')).toBeTruthy();
  });
});
