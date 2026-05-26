import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KnowledgeStorageUsagePanel } from '@/components/knowledge/KnowledgeStorageUsagePanel';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
} from '@/lib/trainedKnowledgeStorageCopy';
import type { CustomerKnowledgeUsage } from '@/api/types';

const usage: CustomerKnowledgeUsage = {
  totalBytes: 1024,
  trainableBytes: 1024,
  maxBytes: 5 * 1024 * 1024,
  remainingBytes: 5 * 1024 * 1024 - 1024,
  percentUsed: (1024 / (5 * 1024 * 1024)) * 100,
  documentBytes: 1024,
  faqBytes: 0,
  noteBytes: 0,
  tableBytes: 0,
  suggestionBytes: 0,
  sectionLimits: {
    faqTotalMaxBytes: 1,
    snippetTotalMaxBytes: 1,
    suggestionTotalMaxBytes: 1,
  },
};

describe('KnowledgeStorageUsagePanel', () => {
  it('shows trained knowledge storage label and helper in full variant', () => {
    const { container } = render(<KnowledgeStorageUsagePanel usage={usage} variant="full" />);
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_LABEL)).toBeTruthy();
    expect(container.textContent).toContain(TRAINED_KNOWLEDGE_STORAGE_HELPER);
  });

  it('uses trained knowledge storage in compact aria label', () => {
    render(<KnowledgeStorageUsagePanel usage={usage} variant="compact" />);
    expect(screen.getByLabelText('Trained knowledge storage used versus limit')).toBeTruthy();
  });
});
