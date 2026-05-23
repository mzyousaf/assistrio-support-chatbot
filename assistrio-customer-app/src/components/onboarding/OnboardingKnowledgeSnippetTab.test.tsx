import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OnboardingKnowledgeSnippetTab } from './OnboardingKnowledgeSnippetTab';

const noopAsync = vi.fn(async () => ({ ok: true }));

const baseProps = {
  disabled: false,
  busy: false,
  onCreate: noopAsync,
  onUpdate: noopAsync,
  onDelete: noopAsync,
  onBulkDelete: noopAsync,
  onImport: noopAsync,
};

describe('OnboardingKnowledgeSnippetTab render order', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders snippets in the order provided by props (C, B, A)', () => {
    render(
      <OnboardingKnowledgeSnippetTab
        {...baseProps}
        snippets={[
          { id: 'c', title: 'Snippet C', description: 'Body C' },
          { id: 'b', title: 'Snippet B', description: 'Body B' },
          { id: 'a', title: 'Snippet A', description: 'Body A' },
        ]}
      />,
    );

    const titles = [...document.querySelectorAll('.knowledge-list-card-title')].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(['Snippet C', 'Snippet B', 'Snippet A']);
  });
});
