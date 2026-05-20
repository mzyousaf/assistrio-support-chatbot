import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MessageCreditBadge,
  creditBreakdownTooltipText,
  shouldShowMessageCreditBadge,
} from './MessageCreditBadge';

describe('MessageCreditBadge', () => {
  it('shows total credits from creditCost', () => {
    const html = renderToStaticMarkup(<MessageCreditBadge creditCost={1.5} creditReason="composite:text_message+dictation_session" />);
    expect(html).toContain('1.5 AI Credits');
  });

  it('labels suggested_question_message breakdown rows as Text message for visitors', () => {
    const breakdown = [
      {
        key: 'suggested_question_message',
        label: 'Suggested question',
        count: 1,
        creditsEach: 1,
        creditsUsed: 1,
        billable: true,
      },
    ];
    const tooltip = creditBreakdownTooltipText(breakdown);
    expect(tooltip).toContain('Credits usage');
    expect(tooltip).toContain('Text message: 1');
    expect(tooltip).not.toContain('Suggested question:');

    const html = renderToStaticMarkup(
      <MessageCreditBadge creditCost={1} creditReason="text_message" creditBreakdown={breakdown} />,
    );
    expect(html).toContain('1 AI Credit');
    expect(html).toContain('relative');
  });

  it('surfaces breakdown visitor labels in credit tooltip', () => {
    const breakdown = [
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
    ];
    const tooltip = creditBreakdownTooltipText(breakdown);
    expect(tooltip).toContain('Credits usage');
    expect(tooltip).toContain('Text message: 1');
    expect(tooltip).toContain('Attachment — not billable: 0');

    const html = renderToStaticMarkup(
      <MessageCreditBadge creditCost={1} creditReason="text_message" creditBreakdown={breakdown} />,
    );
    expect(html).toContain('1 AI Credit');
  });

  it('does not show credit tooltip when breakdown is missing', () => {
    const html = renderToStaticMarkup(
      <MessageCreditBadge creditCost={1} creditReason="text_message" />,
    );
    expect(html).toContain('1 AI Credit');
    expect(html).not.toContain('relative');
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
