import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TranslationSection } from './TranslationSection';

vi.mock('./BotWorkspaceContext', () => ({
  useBotWorkspace: () => ({
    bot: {
      id: 'bot_1',
      translationSettings: { enabled: false, mode: 'english_only', transcriptLanguage: 'english' },
    },
    botId: 'bot_1',
    softReload: async () => undefined,
  }),
}));

vi.mock('../../api/customerApi', () => ({
  patchCustomerBot: async () => ({ ok: true }),
}));

vi.mock('./workspaceManualSaveGuard', () => ({
  registerManualSaveGuard: () => () => undefined,
}));

describe('TranslationSection', () => {
  it('renders title, hero, and disabled-state copy', () => {
    const html = renderToStaticMarkup(React.createElement(TranslationSection));
    expect(html).toContain('Translation');
    expect(html).toContain('Speak every customer');
    expect(html).toContain('Let your assistant understand customers in any language');
  });

  it('renders all translation mode cards and transcript-English notice', () => {
    const html = renderToStaticMarkup(React.createElement(TranslationSection));
    expect(html).toContain('English only');
    expect(html).toContain('Auto customer language');
    expect(html).toContain('Fixed language');
    expect(html).toContain('Voice message transcripts are always stored in English');
    expect(html).toContain('Always English');
  });
});
