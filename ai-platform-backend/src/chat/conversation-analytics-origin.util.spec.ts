import {
  mergeConversationOriginRecords,
  resolveConversationStartedFrom,
  resolvePageUrlFromSourcePage,
  sanitizeConversationOriginForPersistence,
  stripUrlQueryAndHashForStorage,
} from './conversation-analytics-origin.util';
import type { ConversationOriginPayload } from './chat-engine.types';

describe('resolveConversationStartedFrom', () => {
  it('maps widget_preview to playground_preview', () => {
    expect(resolveConversationStartedFrom({ sessionSource: 'widget_preview' })).toBe('playground_preview');
  });

  it('maps shared_preview to shared_preview', () => {
    expect(resolveConversationStartedFrom({ sessionSource: 'shared_preview' })).toBe('shared_preview');
  });

  it('maps shared_link sessionSource to shared_preview', () => {
    expect(resolveConversationStartedFrom({ sessionSource: 'shared_link' })).toBe('shared_preview');
  });

  it('maps iframe_embed to runtime_iframe', () => {
    expect(resolveConversationStartedFrom({ sessionSource: 'iframe_embed' })).toBe('runtime_iframe');
  });

  it('maps runtime + embedType widget to runtime_widget', () => {
    expect(
      resolveConversationStartedFrom({
        sessionSource: 'runtime',
        conversationOrigin: { embedType: 'widget' },
      }),
    ).toBe('runtime_widget');
  });

  it('maps runtime + source script_embed to runtime_widget', () => {
    expect(
      resolveConversationStartedFrom({
        sessionSource: 'runtime',
        conversationOrigin: { source: 'script_embed' },
      }),
    ).toBe('runtime_widget');
  });

  it('maps missing sessionSource to unknown', () => {
    expect(resolveConversationStartedFrom({})).toBe('unknown');
  });

  it('maps playground_preview origin source to playground_preview even when session is runtime', () => {
    expect(
      resolveConversationStartedFrom({
        sessionSource: 'runtime',
        conversationOrigin: { source: 'playground_preview' },
      }),
    ).toBe('playground_preview');
  });

  it('maps shared_preview embedType to shared_preview', () => {
    expect(
      resolveConversationStartedFrom({
        sessionSource: 'runtime',
        conversationOrigin: { embedType: 'shared_preview' },
      }),
    ).toBe('shared_preview');
  });
});

describe('stripUrlQueryAndHashForStorage', () => {
  it('removes query and hash from http(s) URLs', () => {
    expect(stripUrlQueryAndHashForStorage('https://shop.example.com/pricing?utm=secret#top')).toBe(
      'https://shop.example.com/pricing',
    );
  });

  it('trims trailing slash except root', () => {
    expect(stripUrlQueryAndHashForStorage('https://example.com/blog/')).toBe('https://example.com/blog');
    expect(stripUrlQueryAndHashForStorage('https://example.com/')).toBe('https://example.com/');
  });
});

describe('resolvePageUrlFromSourcePage', () => {
  it('resolves pathname with website origin', () => {
    expect(resolvePageUrlFromSourcePage('/bots/1/playground', 'https://app.example.com')).toBe(
      'https://app.example.com/bots/1/playground',
    );
  });
});

describe('sanitizeConversationOriginForPersistence', () => {
  it('strips query params from pageUrl on persist', () => {
    const out = sanitizeConversationOriginForPersistence({
      source: 'script_embed',
      pageUrl: 'https://shop.example.com/help?token=abc',
    });
    expect(out?.pageUrl).toBe('https://shop.example.com/help');
  });

  it('truncates URLs and drops invalid source', () => {
    const long = 'a'.repeat(2000);
    const out = sanitizeConversationOriginForPersistence({
      source: 'not_a_real_source',
      pageUrl: long,
      websiteOrigin: long,
    } as unknown as ConversationOriginPayload);
    expect(out?.source).toBeUndefined();
    expect(String(out?.pageUrl).length).toBeLessThanOrEqual(1000);
    expect(String(out?.websiteOrigin).length).toBeLessThanOrEqual(300);
  });
});

describe('mergeConversationOriginRecords', () => {
  it('merges without deleting existing keys when incoming has empty strings', () => {
    const merged = mergeConversationOriginRecords(
      { shareSlug: 'abc', pageUrl: 'https://old.example/x' },
      { pageUrl: '', referrer: 'https://r' },
    );
    expect(merged?.shareSlug).toBe('abc');
    expect(merged?.referrer).toBe('https://r');
    expect(merged?.pageUrl).toBe('https://old.example/x');
  });
});
