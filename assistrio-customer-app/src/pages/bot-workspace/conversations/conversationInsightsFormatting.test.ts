import { describe, expect, it } from 'vitest';
import type { CustomerConversationDetail } from '@/api/types';
import {
  INSIGHT_EM_DASH,
  sanitizedHostPath,
  sanitizedHttpHost,
  sanitizedHttpHttpsHref,
  visitorOriginHref,
  visitorOriginLineDisplay,
  visitorPageHref,
  visitorPageLineDisplay,
  visitorReferrerHref,
  visitorReferrerLineDisplay,
} from './conversationInsightsFormatting';

function minimalDetail(overrides: Partial<CustomerConversationDetail>): CustomerConversationDetail {
  return {
    id: 'c1',
    conversationId: 'c1',
    botId: 'b1',
    status: 'active',
    startedAt: null,
    firstUserMessageAt: null,
    lastUserMessageAt: null,
    lastAssistantMessageAt: null,
    lastMessageAt: null,
    lastActivityAt: null,
    createdAt: null,
    endedAt: null,
    totalUserMessages: 0,
    totalAssistantMessages: 0,
    totalMessages: 0,
    textMessageCount: 0,
    voiceMessageCount: 0,
    dictationMessageCount: 0,
    attachmentMessageCount: 0,
    suggestedQuestionMessageCount: 0,
    quickReplyMessageCount: 0,
    totalCreditsUsed: 0,
    sourcesUsedCount: 0,
    hasLead: false,
    leadCapturedAt: null,
    hasVoice: false,
    hasDictation: false,
    hasAttachment: false,
    ...overrides,
  };
}

describe('sanitizedHttpHost', () => {
  it('includes non-default ports', () => {
    expect(sanitizedHttpHost('http://localhost:3002')).toBe('localhost:3002');
    expect(sanitizedHttpHost('https://localhost:3002/foo')).toBe('localhost:3002');
  });

  it('accepts scheme-less host[:port]', () => {
    expect(sanitizedHttpHost('localhost:3002')).toBe('localhost:3002');
    expect(sanitizedHttpHost('example.com')).toBe('example.com');
  });

  it('does not expose query or hash segments', () => {
    expect(sanitizedHttpHost('https://example.com/path?q=a&b=c#frag')).toBe('example.com');
  });

  it('returns undefined for empty or non-http(s) URLs', () => {
    expect(sanitizedHttpHost('')).toBeUndefined();
    expect(sanitizedHttpHost('   ')).toBeUndefined();
    expect(sanitizedHttpHost('ftp://example.com')).toBeUndefined();
    expect(sanitizedHttpHost('javascript:alert(1)')).toBeUndefined();
    expect(sanitizedHttpHost('file:///etc/passwd')).toBeUndefined();
  });
});

describe('sanitizedHostPath', () => {
  it('drops query and hash but keeps host with port and path', () => {
    expect(sanitizedHostPath('http://localhost:3002/share/sc?q=tok#h')).toBe('localhost:3002/share/sc');
  });
});

describe('visitorOriginLineDisplay', () => {
  it('prefers websiteOrigin', () => {
    const d = minimalDetail({
      conversationOrigin: {
        websiteOrigin: 'http://localhost:3002',
        parentOrigin: 'https://parent.example',
        pageUrl: 'https://page.example/p',
        referrer: 'https://ref.example/r',
      },
    });
    expect(visitorOriginLineDisplay(d)).toBe('localhost:3002');
  });

  it('falls back to parentOrigin', () => {
    const d = minimalDetail({
      conversationOrigin: {
        parentOrigin: 'https://parent.example:444',
        pageUrl: 'https://ignored.example/',
      },
    });
    expect(visitorOriginLineDisplay(d)).toBe('parent.example:444');
  });

  it('falls back to page hostname when websiteOrigin and parentOrigin are absent', () => {
    const d = minimalDetail({
      conversationOrigin: {
        pageUrl: 'https://shop.example.com/pricing',
      },
    });
    expect(visitorOriginLineDisplay(d)).toBe('shop.example.com');
  });

  it('falls back to referrer host when earlier fields are absent', () => {
    const d = minimalDetail({
      conversationOrigin: {
        referrer: 'http://localhost:3002/other?q=s',
      },
    });
    expect(visitorOriginLineDisplay(d)).toBe('localhost:3002');
  });

  it('returns em dash when nothing parses', () => {
    expect(visitorOriginLineDisplay(minimalDetail({ conversationOrigin: {} }))).toBe(INSIGHT_EM_DASH);
    expect(visitorOriginLineDisplay(minimalDetail({ conversationOrigin: undefined }))).toBe(INSIGHT_EM_DASH);
  });
});

describe('sanitizedHttpHttpsHref', () => {
  it('strips query, hash, and credentials', () => {
    expect(sanitizedHttpHttpsHref('http://localhost:3002/share/x?t=1#h')).toBe('http://localhost:3002/share/x');
    expect(sanitizedHttpHttpsHref('https://user:pass@example.com/path?q=a')).toBe('https://example.com/path');
  });

  it('rejects unsafe schemes', () => {
    expect(sanitizedHttpHttpsHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizedHttpHttpsHref('ftp://example.com/')).toBeUndefined();
    expect(sanitizedHttpHttpsHref('file:///tmp/x')).toBeUndefined();
    expect(sanitizedHttpHttpsHref('data:text/html,hi')).toBeUndefined();
  });
});

describe('visitorOriginHref', () => {
  it('matches origin fallback chain and returns origin-only URLs', () => {
    const d = minimalDetail({
      conversationOrigin: {
        parentOrigin: 'http://localhost:9999',
        websiteOrigin: 'http://localhost:3002/extra',
      },
    });
    expect(visitorOriginHref(d)).toBe('http://localhost:3002');
  });

  it('falls back like visitorOriginLineDisplay', () => {
    const d = minimalDetail({
      conversationOrigin: {
        pageUrl: 'https://shop.example.com/pricing?q=x',
      },
    });
    expect(visitorOriginHref(d)).toBe('https://shop.example.com');
  });
});

describe('visitorPageHref', () => {
  it('returns page URL without query or hash', () => {
    const d = minimalDetail({
      conversationOrigin: {
        pageUrl: 'http://localhost:3002/share/sc?q=secret',
      },
    });
    expect(visitorPageHref(d)).toBe('http://localhost:3002/share/sc');
  });

  it('returns undefined for unsafe page URLs', () => {
    const d = minimalDetail({
      conversationOrigin: { pageUrl: 'javascript:void(0)' },
    });
    expect(visitorPageHref(d)).toBeUndefined();
  });
});

describe('visitorReferrerLineDisplay and visitorReferrerHref', () => {
  it('shows host + path without query', () => {
    const d = minimalDetail({
      conversationOrigin: {
        referrer: 'http://localhost:3002/prev/other?t=1#h',
      },
    });
    expect(visitorReferrerLineDisplay(d)).toBe('localhost:3002/prev/other');
    expect(visitorReferrerHref(d)).toBe('http://localhost:3002/prev/other');
  });

  it('returns em dash and undefined href when referrer is unsafe', () => {
    const d = minimalDetail({
      conversationOrigin: { referrer: 'javascript:alert(1)' },
    });
    expect(visitorReferrerLineDisplay(d)).toBe(INSIGHT_EM_DASH);
    expect(visitorReferrerHref(d)).toBeUndefined();
  });
});

describe('visitorPageLineDisplay', () => {
  it('shows host with port and path without query', () => {
    const d = minimalDetail({
      conversationOrigin: {
        pageUrl: 'http://localhost:3002/share/sc-f8747cccc1cb4725?t=1',
      },
    });
    expect(visitorPageLineDisplay(d)).toBe('localhost:3002/share/sc-f8747cccc1cb4725');
  });
});
