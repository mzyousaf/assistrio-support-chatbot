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

  it('lists User Account and Workspace in sidebar order', () => {
    expect(SETTINGS_NAV_ITEMS.map((item) => item.label)).toEqual([
      'User Account',
      'Workspace',
      'Members',
      'Plans',
      'Billing',
    ]);
  });

  it('maps legacy /settings/general to User Account active index', () => {
    expect(normalizeSettingsPathname('/settings/general')).toBe('/settings/account');
    expect(resolveSettingsNavActiveIndex('/settings/general')).toBe(0);
  });

  it('resolves active nav index for workspace route', () => {
    expect(resolveSettingsNavActiveIndex('/settings/workspace')).toBe(1);
    expect(resolveSettingsNavActiveIndex('/settings/members')).toBe(2);
  });
});

describe('settings routes', () => {
  afterEach(() => cleanup());

  it('redirects /settings/general to /settings/account', () => {
    render(
      <MemoryRouter initialEntries={['/settings/general']}>
        <Routes>
          <Route path="/settings/general" element={<Navigate to="/settings/account" replace />} />
          <Route path="/settings/account" element={<div>User Account page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('User Account page')).toBeTruthy();
  });
});
