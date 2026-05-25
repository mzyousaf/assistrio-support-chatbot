import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE,
  BOT_WORKSPACE_READ_ONLY_NOTE,
} from '@/lib/botsListMessages';
import { ReadOnlyWorkspaceNotice } from './ReadOnlyWorkspaceNotice';

describe('ReadOnlyWorkspaceNotice', () => {
  afterEach(() => cleanup());

  it('shows default agent read-only note', () => {
    render(<ReadOnlyWorkspaceNotice />);
    expect(screen.getByText(BOT_WORKSPACE_READ_ONLY_NOTE)).toBeTruthy();
  });

  it('shows knowledge read-only note for knowledge variant', () => {
    render(<ReadOnlyWorkspaceNotice variant="knowledge" />);
    expect(screen.getByText(BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE)).toBeTruthy();
  });
});
