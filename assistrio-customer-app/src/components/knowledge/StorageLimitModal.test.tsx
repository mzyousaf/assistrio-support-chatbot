import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageLimitModal, StorageLowWarningModal, KnowledgePlanLimitDetailActions } from '@/components/knowledge/StorageLimitModal';
import {
  TRAINED_KNOWLEDGE_STORAGE_HELPER,
  TRAINED_KNOWLEDGE_STORAGE_LABEL,
  TRAINED_KNOWLEDGE_STORAGE_LIMIT_TITLE,
  TRAINED_KNOWLEDGE_STORAGE_LOW_TITLE,
  TRAINED_KNOWLEDGE_STORAGE_UPGRADE_ACTION,
  TRAINED_KNOWLEDGE_STORAGE_VIEW_ACTION,
} from '@/lib/trainedKnowledgeStorageCopy';
import type { CustomerKnowledgeUsage } from '@/api/types';

const usage: CustomerKnowledgeUsage = {
  totalBytes: 5 * 1024 * 1024,
  trainableBytes: 5 * 1024 * 1024,
  maxBytes: 5 * 1024 * 1024,
  remainingBytes: 0,
  percentUsed: 100,
  documentBytes: 5 * 1024 * 1024,
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

afterEach(() => {
  cleanup();
});

describe('StorageLimitModal', () => {
  it('uses trained knowledge storage limit wording', () => {
    render(
      <MemoryRouter>
        <StorageLimitModal open botId="bot-1" onClose={vi.fn()} knowledgeUsage={usage} />
      </MemoryRouter>,
    );
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_LIMIT_TITLE)).toBeTruthy();
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_HELPER)).toBeTruthy();
    expect(screen.getByLabelText(`${TRAINED_KNOWLEDGE_STORAGE_LABEL} usage`)).toBeTruthy();
    expect(screen.getByRole('button', { name: TRAINED_KNOWLEDGE_STORAGE_UPGRADE_ACTION })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manage knowledge' })).toBeTruthy();
  });
});

describe('KnowledgePlanLimitDetailActions', () => {
  it('uses trained knowledge storage action labels', () => {
    render(
      <MemoryRouter>
        <KnowledgePlanLimitDetailActions botId="bot-1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: TRAINED_KNOWLEDGE_STORAGE_VIEW_ACTION })).toBeTruthy();
    expect(screen.getByRole('button', { name: TRAINED_KNOWLEDGE_STORAGE_UPGRADE_ACTION })).toBeTruthy();
  });
});

describe('StorageLowWarningModal', () => {
  it('uses low trained knowledge storage title', () => {
    render(
      <MemoryRouter>
        <StorageLowWarningModal
          open
          message="warn"
          onContinue={vi.fn()}
          onCancel={vi.fn()}
          botId="bot-1"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(TRAINED_KNOWLEDGE_STORAGE_LOW_TITLE)).toBeTruthy();
  });
});
