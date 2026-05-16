import { describe, expect, it } from 'vitest';
import type { CustomerConversationMessage } from '@/api/types';
import { buildConversationCreditBreakdown } from './conversationCreditBreakdown';

function baseUser(o: Partial<CustomerConversationMessage> & Pick<CustomerConversationMessage, 'id' | 'messageId'>): CustomerConversationMessage {
  return {
    id: o.id,
    messageId: o.messageId,
    role: 'user',
    content: o.content ?? '',
    text: o.text ?? o.content ?? '',
    createdAt: o.createdAt ?? new Date().toISOString(),
    attachments: o.attachments,
    creditCost: o.creditCost,
    creditReason: o.creditReason,
    quotaPeriod: o.quotaPeriod,
    chargedAt: o.chargedAt,
    creditBreakdown: o.creditBreakdown,
    voiceMeta: o.voiceMeta,
  };
}

describe('buildConversationCreditBreakdown', () => {
  it('sums creditCost totals only', () => {
    const messages: CustomerConversationMessage[] = [
      baseUser({
        id: '1',
        messageId: '1',
        content: 'a',
        creditCost: 1,
        creditReason: 'text_message',
      }),
      baseUser({
        id: '2',
        messageId: '2',
        content: 'b',
        creditCost: 3,
        creditReason: 'composite:text_message+dictation_session',
        creditBreakdown: [
          { key: 'text_message', label: 'Text message', count: 1, creditsEach: 1, creditsUsed: 1, billable: true },
          { key: 'dictation_session', label: 'Dictation', count: 1, creditsEach: 2, creditsUsed: 2, billable: true },
        ],
        voiceMeta: { dictationSessionCount: 1 },
      }),
    ];
    const p = buildConversationCreditBreakdown(messages);
    expect(p.totalFromMessages).toBe(4);
    expect(p.rollupByBreakdownComponents.length).toBe(2);
    expect(p.rows[0]?.breakdownAvailable).toBe(true);
    expect(p.rows[p.rows.length - 1]?.breakdownAvailable).toBe(false);
  });

  it('falls back gracefully when breakdown missing', () => {
    const p = buildConversationCreditBreakdown([
      baseUser({
        id: '1',
        messageId: '1',
        content: 'old',
        creditCost: 1,
        creditReason: 'dictation_message',
      }),
    ]);
    expect(p.rollupByBreakdownComponents.length).toBe(0);
    expect(p.rows[0]?.breakdownAvailable).toBe(false);
  });

  it('shows decimal totals from stored rows', () => {
    const p = buildConversationCreditBreakdown([
      baseUser({
        id: '1',
        messageId: '1',
        content: 'x',
        creditCost: 1.5,
        creditReason: 'text_message',
        creditBreakdown: [
          {
            key: 'text_message',
            label: 'Text message',
            count: 1,
            creditsEach: 1.5,
            creditsUsed: 1.5,
            billable: true,
          },
        ],
      }),
    ]);
    expect(p.rollupByBreakdownComponents.find((x) => x.key === 'text_message')?.creditsUsed).toBe(1.5);
  });
});
