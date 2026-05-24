import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PreserveSearchNavigate } from './PreserveSearchNavigate';

function SearchEcho() {
  const location = useLocation();
  return <div data-testid="search">{location.search}</div>;
}

describe('PreserveSearchNavigate', () => {
  it('preserves search params when redirecting from bot index route', () => {
    render(
      <MemoryRouter initialEntries={['/bots/abc?showInstall=1&liveBotId=abc']}>
        <Routes>
          <Route path="/bots/:id" element={<PreserveSearchNavigate to="playground/profile" />} />
          <Route path="/bots/:id/playground/profile" element={<SearchEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('search').textContent).toBe('?showInstall=1&liveBotId=abc');
  });
});
