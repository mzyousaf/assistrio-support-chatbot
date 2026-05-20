import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerConversationDetail } from '@/api/types';
import { ConversationInsightsVisitorTab } from './conversationInsightsTabPanels';

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

describe('ConversationInsightsVisitorTab Page source', () => {
  it('renders Origin, Page, Referrer as external links without Source type row', () => {
    const detail = minimalDetail({
      conversationOrigin: {
        websiteOrigin: 'http://localhost:3002',
        pageUrl: 'http://localhost:3002/share/sc?q=secret',
        referrer: 'http://localhost:3002/from?x=1#frag',
      },
    });
    const html = renderToStaticMarkup(<ConversationInsightsVisitorTab detail={detail} />);
    expect(html).not.toContain('Source type');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html.match(/target="_blank"/g)?.length).toBe(3);
    expect(html).toContain('href="http://localhost:3002"');
    expect(html).toContain('href="http://localhost:3002/share/sc"');
    expect(html).toContain('href="http://localhost:3002/from"');
    expect(html).not.toContain('q=secret');
    expect(html).not.toContain('x=1');
  });

  it('does not emit javascript href for unsafe referrer', () => {
    const detail = minimalDetail({
      conversationOrigin: {
        referrer: 'javascript:alert(1)',
        pageUrl: 'http://safe.example/page',
      },
    });
    const html = renderToStaticMarkup(<ConversationInsightsVisitorTab detail={detail} />);
    expect(html).not.toMatch(/href="javascript:/);
    expect(html).toContain('href="http://safe.example/page"');
  });
});
