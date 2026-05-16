import { describe, expect, it } from 'vitest';
import { formatSentimentOverTimeTooltipCount } from './SentimentOverTimeChart';

describe('SentimentOverTimeChart helpers', () => {
  it('formats tooltip counts as friendly user-message phrases', () => {
    expect(formatSentimentOverTimeTooltipCount(1)).toMatch(/1/);
    expect(formatSentimentOverTimeTooltipCount(1)).toContain('user messages');
    expect(formatSentimentOverTimeTooltipCount(12042)).toContain('user messages');
  });

  it('formats chat-based tooltip counts when unit is chats', () => {
    expect(formatSentimentOverTimeTooltipCount(3, 'chats')).toContain('distinct chats');
  });
});
