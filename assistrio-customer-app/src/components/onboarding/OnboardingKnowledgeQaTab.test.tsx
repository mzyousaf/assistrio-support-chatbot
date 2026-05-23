import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { OnboardingKnowledgeQaTab } from './OnboardingKnowledgeQaTab';

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

describe('OnboardingKnowledgeQaTab render order', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Q&A items in the order provided by props (C, B, A)', () => {
    render(
      <OnboardingKnowledgeQaTab
        {...baseProps}
        qas={[
          { id: 'c', title: 'Q&A C', questions: ['Q?'], answer: 'A' },
          { id: 'b', title: 'Q&A B', questions: ['Q?'], answer: 'A' },
          { id: 'a', title: 'Q&A A', questions: ['Q?'], answer: 'A' },
        ]}
      />,
    );

    const titles = [...document.querySelectorAll('.knowledge-list-card-title')].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual(['Q&A C', 'Q&A B', 'Q&A A']);
  });
});
