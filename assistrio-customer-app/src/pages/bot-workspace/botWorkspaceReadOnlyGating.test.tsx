import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE } from '@/lib/botsListMessages';
import { QaListPage } from './knowledge/QaListPage';
import { BehaviorSection } from './BehaviorSection';

let mockCanManageBot = false;

vi.mock('./BotWorkspaceContext', () => ({
  useBotWorkspace: () => ({
    bot: {
      id: 'bot-1',
      faqs: [],
      notes: [],
      tables: [],
      exampleQuestions: [],
    },
    botId: 'bot-1',
    loadState: 'ok',
    softReload: vi.fn(),
    canManageBot: mockCanManageBot,
  }),
  useCanManageBot: () => mockCanManageBot,
}));

vi.mock('./BehaviorWorkspaceContext', () => ({
  useBehaviorWorkspace: () => ({
    activeSubnav: 'personality',
    setActiveSubnav: vi.fn(),
    dirty: true,
    selectedCategories: [],
    customCategoryMode: false,
    customCategoryText: '',
    setCustomCategoryText: vi.fn(),
    toggleCategoryPill: vi.fn(),
    behaviorPreset: 'custom',
    setBehaviorPreset: vi.fn(),
    tone: 'friendly',
    setTone: vi.fn(),
    personalityDescription: '',
    setPersonalityDescription: vi.fn(),
    thingsToAvoid: '',
    setThingsToAvoid: vi.fn(),
    welcomeMessage: '',
    setWelcomeMessage: vi.fn(),
    welcomeMessageEnabled: true,
    setWelcomeMessageEnabled: vi.fn(),
    saving: false,
    saveError: null,
    save: vi.fn(),
  }),
}));

vi.mock('@/context/KnowledgeStorageUxContext', () => ({
  useKnowledgeStorageUx: () => ({ notifyPlanLimitFromApi: vi.fn(), interceptKnowledgeStorageIncrease: (fn: () => void) => fn() }),
  useDismissKnowledgeCompanionModalsOnStorageClose: () => {},
}));

vi.mock('@/context/KbWorkspacePollingContext', () => ({
  useKbKnowledgeStatusPollInterest: () => {},
  useKbWorkspacePolling: () => ({
    knowledgeStatusItems: [],
    refreshKnowledgeStatus: vi.fn(),
    refreshTrainingStatus: vi.fn(),
  }),
}));

vi.mock('./knowledge/useKbTrainingStartedStatusRefetch', () => ({
  useKbTrainingStartedStatusRefetch: () => {},
}));

vi.mock('./knowledge/knowledgeSourcesListUi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./knowledge/knowledgeSourcesListUi')>();
  return {
    ...actual,
    useKnowledgeTrainingGateModal: () => ({
      trainingGateModal: null,
      blockIfTrainingForItem: () => false,
    }),
  };
});

function renderQaList() {
  return render(
    <MemoryRouter initialEntries={['/bots/bot-1/playground/knowledgebase/faqs']}>
      <Routes>
        <Route path="/bots/:id/playground/knowledgebase/faqs" element={<QaListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('bot workspace read-only UI gating', () => {
  afterEach(() => {
    cleanup();
    mockCanManageBot = false;
  });

  describe('QaListPage', () => {
    it('hides add/import/delete controls for workspace members', () => {
      mockCanManageBot = false;
      renderQaList();

      expect(screen.getByText(BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /import csv/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /add q&a/i })).toBeNull();
    });

    it('shows add/import controls for workspace admins', () => {
      mockCanManageBot = true;
      renderQaList();

      expect(screen.queryByText(BOT_WORKSPACE_KNOWLEDGE_READ_ONLY_NOTE)).toBeNull();
      expect(screen.getByRole('button', { name: /import csv/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /add q&a/i })).toBeTruthy();
    });
  });

  describe('BehaviorSection', () => {
    it('hides save button for workspace members', () => {
      mockCanManageBot = false;
      render(<BehaviorSection />);
      expect(screen.queryByRole('button', { name: /save behavior/i })).toBeNull();
      expect(document.querySelector('[data-behavior-editor] fieldset[disabled]')).toBeTruthy();
    });

    it('allows workspace members to switch behavior sub-tabs', () => {
      mockCanManageBot = false;
      render(<BehaviorSection />);

      const tablist = screen.getByRole('tablist', { name: /behavior sections/i });
      expect(tablist.closest('fieldset[disabled]')).toBeNull();

      const firstMessageTab = screen.getByRole('tab', { name: /agent first message/i });
      expect(firstMessageTab.hasAttribute('disabled')).toBe(false);
    });

    it('shows save button for workspace admins', () => {
      mockCanManageBot = true;
      render(<BehaviorSection />);
      expect(screen.getByRole('button', { name: /save behavior/i })).toBeTruthy();
    });
  });
});
