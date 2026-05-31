const MAX_AGENT_DESCRIPTION_LENGTH = 480;

function normalizeSource(raw: string): string {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean);
  if (parts?.length) return parts;
  return text ? [text] : [];
}

function truncateAtWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen - 1);
  const trimmed = slice.replace(/\s+\S*$/, '').trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

/**
 * Short business-facing bot.description from onboarding "Describe Your AI Agent" text.
 * Avoids copying full behavior prompts, headings, or rule blocks.
 */
export function buildAgentDescriptionFromOnboardingInstructions(text: string): string {
  const source = normalizeSource(text);
  if (!source) {
    return 'This AI Agent helps customers get clear answers using the available knowledge base in a friendly, professional way.';
  }

  const sentences = splitSentences(source);
  const lead = sentences.slice(0, 2).join(' ').trim();
  const instructionLike =
    /^(you are|be helpful|responsibilities|bot instructions|your role)/i.test(lead) ||
    lead.length > MAX_AGENT_DESCRIPTION_LENGTH;

  if (!instructionLike && lead.length >= 40) {
    return truncateAtWordBoundary(lead, MAX_AGENT_DESCRIPTION_LENGTH);
  }

  const focus = sentences[0]?.replace(/[.!?]+$/, '').trim().slice(0, 220) ?? '';
  const focusClause =
    focus.length >= 20
      ? `related to ${focus.charAt(0).toLowerCase()}${focus.slice(1)}`
      : 'about products, services, pricing, policies, and support questions';

  const generated =
    `This AI Agent helps customers get clear answers ${focusClause}. ` +
    'It responds in a friendly, professional way and uses the available knowledge base to guide users to the right next step.';

  return truncateAtWordBoundary(generated, MAX_AGENT_DESCRIPTION_LENGTH);
}
