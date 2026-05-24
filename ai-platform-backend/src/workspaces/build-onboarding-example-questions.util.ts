const EXAMPLE_QUESTION_MAX_LEN = 140;
const EXAMPLE_QUESTION_MAX_COUNT = 4;

/** Category-aware starter questions (deterministic). */
const CATEGORY_STARTER_QUESTIONS: Record<string, string[]> = {
  support: ['How can I get help?', 'What are your support policies?'],
  sales: ['What do you offer?', 'How can I learn more about pricing?'],
  marketing: ['What makes your business different?', 'How can I learn more about your services?'],
  onboarding: ['How do I get started?', 'What should I know as a new customer?'],
  hr: ['What HR policies should I know about?', 'How do I reach the HR team?'],
  legal: ['What legal policies apply?', 'How do I contact your legal team?'],
  finance: ['What payment options are available?', 'How do billing and invoices work?'],
  operations: ['How do your operations work?', 'What should I know before getting started?'],
  product: ['What products or features do you offer?', 'How do I choose the right option?'],
  education: ['What programs or courses do you offer?', 'How do I enroll or sign up?'],
  healthcare: ['What services do you provide?', 'How do I book an appointment?'],
  ecommerce: ['What do you sell?', 'How do I place an order?'],
  compliance: ['What compliance policies should I know?', 'Where can I find policy details?'],
  docs: ['Where can I find documentation?', 'How do I search your knowledge base?'],
  general: ['How can you help me today?', 'What services do you offer?'],
};

/** Describe-text keyword → suggested visitor question. */
const DESCRIBE_TOPIC_QUESTIONS: ReadonlyArray<{ pattern: RegExp; question: string }> = [
  { pattern: /\bpric(e|ing)\b/i, question: 'What are your pricing options?' },
  { pattern: /\brefund/i, question: 'What is your refund policy?' },
  { pattern: /\bship(ping|ment)?\b/i, question: 'How does shipping work?' },
  { pattern: /\bdeliver(y|ies)\b/i, question: 'What are your delivery options?' },
  { pattern: /\bwarrant(y|ies)\b/i, question: 'What warranty do you offer?' },
  { pattern: /\breturn(s)?\b/i, question: 'What is your return policy?' },
  { pattern: /\bbill(ing)?\b/i, question: 'How does billing work?' },
  { pattern: /\baccount\b/i, question: 'How do I manage my account?' },
  { pattern: /\bproduct(s)?\b/i, question: 'Tell me about your products.' },
  { pattern: /\bservice(s)?\b/i, question: 'What services do you provide?' },
  { pattern: /\bappointment\b/i, question: 'How do I book an appointment?' },
  { pattern: /\bhour(s)?\b/i, question: 'What are your business hours?' },
  { pattern: /\bsupport\b/i, question: 'How can I contact support?' },
];

const GENERIC_FALLBACK_QUESTIONS = [
  'How can you help me today?',
  'What services do you offer?',
  'How do I get started?',
] as const;

function clampQuestion(text: string): string {
  const trimmed = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (trimmed.length <= EXAMPLE_QUESTION_MAX_LEN) return trimmed;
  return trimmed.slice(0, EXAMPLE_QUESTION_MAX_LEN - 1).replace(/\s+\S*$/, '').trim();
}

function categoryKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function humanizeCategoryLabel(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text) return 'your business';
  if (text.includes(' ')) return text;
  return text.replace(/_/g, ' ');
}

/**
 * Deterministic starter chips from onboarding categories + Describe Your AI Agent text.
 */
export function buildOnboardingExampleQuestionsFromProfile(
  categories: string[],
  describeText: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function add(raw: string) {
    if (out.length >= EXAMPLE_QUESTION_MAX_COUNT) return;
    const question = clampQuestion(raw);
    if (!question) return;
    const key = question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(question);
  }

  const normalizedCategories = categories.map((c) => categoryKey(c)).filter(Boolean);

  for (const cat of normalizedCategories) {
    const starters = CATEGORY_STARTER_QUESTIONS[cat];
    if (starters) {
      for (const q of starters) add(q);
      continue;
    }
    const label = humanizeCategoryLabel(cat);
    add(`Tell me more about ${label}.`);
  }

  const describe = String(describeText ?? '').trim();
  for (const { pattern, question } of DESCRIBE_TOPIC_QUESTIONS) {
    if (pattern.test(describe)) add(question);
  }

  if (out.length === 0) {
    for (const q of GENERIC_FALLBACK_QUESTIONS) add(q);
  }

  return out.slice(0, EXAMPLE_QUESTION_MAX_COUNT);
}
