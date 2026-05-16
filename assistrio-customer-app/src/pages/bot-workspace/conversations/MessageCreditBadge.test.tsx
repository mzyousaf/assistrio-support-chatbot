import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageCreditBadge, shouldShowMessageCreditBadge } from './MessageCreditBadge';

describe('MessageCreditBadge', () => {
  it('shows total credits from creditCost', () => {
    const html = renderToStaticMarkup(<MessageCreditBadge creditCost={1.5} creditReason="composite:text_message+dictation_session" />);
    expect(html).toContain('1.5 AI Credits');
  });

  it('labels suggested_question_message breakdown rows as Text message for visitors', () => {
    const html = renderToStaticMarkup(
      <MessageCreditBadge
        creditCost={1}
        creditReason="text_message"
        creditBreakdown={[
          {
            key: 'suggested_question_message',
            label: 'Suggested question',
            count: 1,
            creditsEach: 1,
            creditsUsed: 1,
            billable: true,
          },
        ]}
      />,
    );
    expect(html).toContain('Credit breakdown');
    expect(html).toContain('Text message: 1');
    expect(html).not.toContain('Suggested question:');
  });

  it('surfaces breakdown visitor labels in title tooltip', () => {
    const html = renderToStaticMarkup(
      <MessageCreditBadge
        creditCost={1}
        creditReason="text_message"
        creditBreakdown={[
          {
            key: 'text_message',
            label: 'Text message',
            count: 1,
            creditsEach: 1,
            creditsUsed: 1,
            billable: true,
          },
          {
            key: 'attachment_message',
            label: 'Attachment',
            count: 1,
            creditsEach: 0,
            creditsUsed: 0,
            billable: false,
          },
        ]}
      />,
    );
    expect(html).toContain('Credit breakdown');
    expect(html).toContain('Text message: 1');
    expect(html).toContain('Attachment — not billable: 0');
  });

  it('shows badge when breakdown exists even if creditCost missing', () => {
    expect(
      shouldShowMessageCreditBadge(undefined, undefined, [
        {
          key: 'attachment_message',
          label: 'Attachment',
          count: 1,
          creditsEach: 0,
          creditsUsed: 0,
          billable: false,
        },
      ]),
    ).toBe(true);
  });
});
