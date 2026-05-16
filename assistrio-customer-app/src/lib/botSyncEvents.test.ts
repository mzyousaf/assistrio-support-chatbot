import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSISTRIO_WORKSPACE_BOT_REFRESH, requestWorkspaceBotRefresh } from './botSyncEvents';

describe('requestWorkspaceBotRefresh', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('dispatches affectedSections and refreshDocumentsList without fan-out to other sections in the event payload', () => {
    requestWorkspaceBotRefresh('bot-1', {
      affectedSections: ['document'],
      refreshDocumentsList: true,
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const ev = spy.mock.calls[0]![0] as CustomEvent;
    expect(ev.type).toBe(ASSISTRIO_WORKSPACE_BOT_REFRESH);
    expect(ev.detail).toEqual({
      botId: 'bot-1',
      affectedSections: ['document'],
      refreshDocumentsList: true,
      invalidateDocumentsListCache: true,
    });
  });

  it('maps legacy invalidateDocumentsListCache to both document cache flags', () => {
    requestWorkspaceBotRefresh('bot-2', { invalidateDocumentsListCache: true });
    const ev = spy.mock.calls[0]![0] as CustomEvent;
    expect(ev.detail.refreshDocumentsList).toBe(true);
    expect(ev.detail.invalidateDocumentsListCache).toBe(true);
    expect(ev.detail.affectedSections).toBeUndefined();
  });

  it('keeps per-source affectedSections scoped (faq/note/table/suggestion)', () => {
    const scoped: Array<'faq' | 'note' | 'table' | 'suggestion'> = ['faq', 'note', 'table', 'suggestion'];
    for (const section of scoped) {
      requestWorkspaceBotRefresh('bot-scope', { affectedSections: [section] });
      const ev = spy.mock.calls.at(-1)?.[0] as CustomEvent;
      expect(ev.detail.affectedSections).toEqual([section]);
      expect(ev.detail.refreshDocumentsList).toBeUndefined();
      expect(ev.detail.invalidateDocumentsListCache).toBeUndefined();
    }
  });
});
