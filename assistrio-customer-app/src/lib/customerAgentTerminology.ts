/** Customer-facing product term. */
export const CUSTOMER_AI_AGENT_TERM = 'AI Agent';

export const CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT =
  'Trained knowledge storage / AI Agent';

export const CUSTOMER_EXTRA_AI_AGENT = 'Extra AI Agent';
export const CUSTOMER_EXTRA_AI_AGENTS = 'Extra AI Agents';

export const CUSTOMER_PER_AI_AGENT = 'per AI Agent';
export const CUSTOMER_PER_AI_AGENT_TITLE = 'Per AI Agent';
export const CUSTOMER_KB_PER_AI_AGENT = 'trained knowledge / AI Agent';

/** Active extra-bot add-on instance label (1-based index). */
export function formatExtraAiAgentInstanceLabel(index: number): string {
  return `${CUSTOMER_EXTRA_AI_AGENT} #${index + 1}`;
}

function normalizeAiAgentCasing(text: string): string {
  return text.replace(/\bAI agents\b/g, 'AI Agents').replace(/\bAI agent\b/g, 'AI Agent');
}

/**
 * Rewrites legacy "bot" product wording in API or catalog strings shown in the customer app.
 * Internal keys (`extra_bot`, `botId`, routes) are unchanged.
 */
export function formatCustomerFacingAgentText(text: string): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return text;

  let out = trimmed;
  const replacements: Array<[string, string]> = [
    ['Extra bot add-on', 'Extra AI Agent add-on'],
    ['Extra bots', CUSTOMER_EXTRA_AI_AGENTS],
    ['Extra bot', CUSTOMER_EXTRA_AI_AGENT],
    ['Add extra bot', 'Add extra AI Agent'],
    ['per month per bot', 'per month per AI Agent'],
    ['per bot', CUSTOMER_PER_AI_AGENT],
    ['Per bot', CUSTOMER_PER_AI_AGENT_TITLE],
    ['Trained knowledge storage / bot', CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT],
    ['trained knowledge / bot', CUSTOMER_KB_PER_AI_AGENT],
    ['/ bot', '/ AI Agent'],
    ['Invalid bot id', 'Invalid AI Agent id'],
    ['Invalid botId', 'Invalid AI Agent id'],
    ['Invalid workspace or bot id.', 'Invalid workspace or AI Agent id.'],
    ['Bot not found', 'AI Agent not found'],
    ['bot limit', 'AI Agent limit'],
    ['Bot ID', 'AI Agent ID'],
    ['Copy bot ID', 'Copy AI Agent ID'],
    ['Bot avatar', 'AI Agent avatar'],
    ['Reactivate the Extra bot add-on', 'Reactivate the Extra AI Agent add-on'],
    [' · Bot ', ' · AI Agent '],
  ];

  for (const [from, to] of replacements) {
    if (out.includes(from)) {
      out = out.split(from).join(to);
    }
  }

  out = out.replace(/This bot’s/g, "This AI Agent's");
  out = out.replace(/This bot's/g, "This AI Agent's");
  out = normalizeAiAgentCasing(out);

  return out === trimmed ? text : out;
}
