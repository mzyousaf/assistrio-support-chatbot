import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_EXTRA_AI_AGENT,
  formatCustomerFacingAgentText,
  formatExtraAiAgentInstanceLabel,
} from './customerAgentTerminology';

describe('customerAgentTerminology', () => {
  it('rewrites legacy bot product wording from API strings', () => {
    expect(formatCustomerFacingAgentText('Extra bot add-on')).toBe('Extra AI Agent add-on');
    expect(formatCustomerFacingAgentText('Trained knowledge storage / bot')).toBe(
      'Trained knowledge storage / AI Agent',
    );
    expect(formatCustomerFacingAgentText('Invalid bot id')).toBe('Invalid AI Agent id');
    expect(formatCustomerFacingAgentText('Extra AI agent')).toBe('Extra AI Agent');
  });

  it('formats extra-bot instance labels', () => {
    expect(formatExtraAiAgentInstanceLabel(0)).toBe(`${CUSTOMER_EXTRA_AI_AGENT} #1`);
  });
});
