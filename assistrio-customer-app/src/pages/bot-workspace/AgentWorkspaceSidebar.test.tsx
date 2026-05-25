import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentWorkspaceSidebar } from './AgentWorkspaceSidebar';

vi.mock('./workspaceManualSaveGuard', () => ({
  hasManualSaveDirty: () => false,
  hasManualSaveDirtyExcluding: () => false,
  hasManualSaveGuardDirty: () => false,
}));

vi.mock('./WorkspaceDiscardModal', () => ({
  useWorkspaceDiscardModal: () => ({
    requestDiscardIfNeeded: vi.fn().mockResolvedValue(true),
    requestDiscardKnowledgeNotesIfNeeded: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('./components/TrainingStatusSidebarCard', () => ({
  TrainingStatusSidebarCard: () => null,
}));

describe('AgentWorkspaceSidebar navigation', () => {
  afterEach(() => cleanup());

  it('switches playground routes when tabs are clicked', () => {
    render(
      <MemoryRouter initialEntries={['/bots/bot-1/playground/profile']}>
        <Routes>
          <Route
            path="/bots/:id/*"
            element={
              <>
                <AgentWorkspaceSidebar bot={{ id: 'bot-1', name: 'Agent', status: 'published' } as never} />
                <Routes>
                  <Route path="playground/profile" element={<div>Profile page</div>} />
                  <Route path="playground/behavior" element={<div>Behavior page</div>} />
                </Routes>
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Profile page')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /^behavior$/i }));
    expect(screen.getByText('Behavior page')).toBeTruthy();
  });
});
