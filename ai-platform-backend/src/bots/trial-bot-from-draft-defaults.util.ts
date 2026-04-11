/**
 * Trial onboarding draft → visitor bot defaults: category presets, welcome copy,
 * suggested questions, chatUI, lead capture. Not used as knowledge base content.
 */

import type { BotLeadCaptureV2 } from '../models/bot.schema';

const BEHAVIOR_PRESETS = new Set([
  'default',
  'support',
  'sales',
  'technical',
  'marketing',
  'consultative',
  'teacher',
  'empathetic',
  'strict',
]);

/** First selected profile category id (landing `TRIAL_PROFILE_CATEGORIES` ids). */
export function resolvePrimaryCategoryId(categories: string[]): string {
  const c = categories.map((x) => String(x ?? '').trim()).filter(Boolean);
  return c[0] ?? 'support';
}

/**
 * Map onboarding category id → BotPersonality.behaviorPreset (schema enum).
 */
export function mapCategoryToBehaviorPreset(categoryId: string): string {
  const id = String(categoryId ?? '').trim().toLowerCase() || 'general';
  const map: Record<string, string> = {
    support: 'support',
    sales: 'sales',
    marketing: 'marketing',
    onboarding: 'consultative',
    hr: 'empathetic',
    legal: 'strict',
    finance: 'consultative',
    operations: 'default',
    product: 'technical',
    education: 'teacher',
    healthcare: 'empathetic',
    ecommerce: 'sales',
    compliance: 'strict',
    documentation: 'technical',
    general: 'default',
  };
  const p = map[id] ?? 'default';
  return BEHAVIOR_PRESETS.has(p) ? p : 'default';
}

export function coerceBehaviorPreset(raw: string | undefined): string | undefined {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return undefined;
  return BEHAVIOR_PRESETS.has(s) ? s : undefined;
}

/** Short role context for system prompt (behavior only — not RAG knowledge). */
export function buildCategoryBehaviorContext(categoryId: string): string {
  const id = String(categoryId ?? '').trim().toLowerCase() || 'general';
  const lines: Record<string, string> = {
    support:
      'Primary focus: customer support — troubleshoot issues, explain policies at a high level, and escalate when appropriate.',
    sales:
      'Primary focus: sales conversations — qualify interest, answer product fit questions, and keep tone helpful and concise.',
    marketing:
      'Primary focus: marketing — clarify messaging, campaigns, and brand-safe answers; avoid inventing unpublished claims.',
    onboarding:
      'Primary focus: user onboarding — guide new users through setup, next steps, and common first questions.',
    hr: 'Primary focus: HR — workplace policies and employee-facing tone; defer sensitive decisions to human HR.',
    legal:
      'Primary focus: legal-aware assistance — clear disclaimers that you are not a lawyer; stick to general information.',
    finance:
      'Primary focus: finance-related questions — be precise; do not invent numbers or binding financial advice.',
    operations:
      'Primary focus: operations — processes, handoffs, and practical how-tos for day-to-day work.',
    product:
      'Primary focus: product education — features, usage, and limitations; avoid guessing unreleased roadmap details.',
    education:
      'Primary focus: teaching and learning — step-by-step explanations and encouragement.',
    healthcare:
      'Primary focus: healthcare-friendly information — no diagnoses; encourage professional care for medical decisions.',
    ecommerce:
      'Primary focus: e-commerce — orders, shipping, returns, and product help in a shopper-friendly way.',
    compliance:
      'Primary focus: compliance-oriented help — careful, policy-aligned language; escalate when unsure.',
    documentation:
      'Primary focus: documentation and technical help — point to clear steps and accurate terminology.',
    general:
      'Primary focus: general assistance — adaptable, accurate, and concise across common visitor questions.',
  };
  return lines[id] ?? lines.general;
}

const GENERIC_SNIPPETS = /\b(help|assist|answer|questions?|customers?|visitors?|support|chat|ai|agent)\b/gi;

/** True when “Describe your AI agent” is too thin to drive bespoke behavior safely. */
export function isWeakAgentDescription(what: string): boolean {
  const t = String(what ?? '').trim();
  if (t.length < 28) return true;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 8) return true;
  const meaningful = t.replace(GENERIC_SNIPPETS, ' ').replace(/\s+/g, ' ').trim();
  if (meaningful.length < 18) return true;
  return false;
}

const CATEGORY_WELCOME_FALLBACK: Record<string, (name: string) => string> = {
  support: (name) =>
    `Hi! I'm ${name}, here to help with product and account questions. What do you need support with today?`,
  sales: (name) =>
    `Hi! I'm ${name}. I can help you explore options and next steps. What are you looking to solve?`,
  marketing: (name) =>
    `Hi! I'm ${name}. Ask me about our messaging, offers, or how we can help your use case.`,
  onboarding: (name) =>
    `Hi! I'm ${name}. New here? I can walk you through setup and your first steps.`,
  hr: (name) =>
    `Hi! I'm ${name}. I can help with workplace and HR-related questions. How can I assist?`,
  legal: (name) =>
    `Hi! I'm ${name}. I share general information only—not legal advice. What topic can I help clarify?`,
  finance: (name) =>
    `Hi! I'm ${name}. I can help with billing and finance-related questions at a high level.`,
  operations: (name) =>
    `Hi! I'm ${name}. Ask me about processes, timelines, or how things work on our side.`,
  product: (name) =>
    `Hi! I'm ${name}. I can explain features and how to get the most out of the product.`,
  education: (name) =>
    `Hi! I'm ${name}. What topic or lesson would you like to explore?`,
  healthcare: (name) =>
    `Hi! I'm ${name}. I provide general information only—not medical advice. How can I help?`,
  ecommerce: (name) =>
    `Hi! I'm ${name}. I can help with orders, delivery, and product questions.`,
  compliance: (name) =>
    `Hi! I'm ${name}. I can help with policy-oriented questions; I’ll flag when a human should review.`,
  documentation: (name) =>
    `Hi! I'm ${name}. Ask me how things work or where to find details in our docs.`,
  general: (name) => `Hi! I'm ${name}. How can I help you today?`,
};

export function buildTrialWelcomeMessage(
  agentName: string,
  primaryCategoryId: string,
  what: string,
  weak: boolean,
): string {
  const name = String(agentName ?? '').trim() || 'your assistant';
  const id = String(primaryCategoryId ?? '').trim().toLowerCase() || 'general';
  if (!weak) {
    const core = what.trim();
    const sentence = core.length > 220 ? `${core.slice(0, 217)}…` : core;
    return `Hi! I'm ${name}. ${sentence} What would you like help with?`.slice(0, 500);
  }
  const fn = CATEGORY_WELCOME_FALLBACK[id] ?? CATEGORY_WELCOME_FALLBACK.general;
  return fn(name).slice(0, 500);
}

const CATEGORY_EXAMPLE_QUESTIONS: Record<string, string[]> = {
  support: [
    'How do I get started?',
    'Something isn’t working — what should I try first?',
    'How do I reach a human on your team?',
    'Where can I find billing or account settings?',
  ],
  sales: [
    'What problems do you solve best?',
    'How does pricing work?',
    'Can you walk me through a quick demo?',
    'What’s the next step if we’re a good fit?',
  ],
  marketing: [
    'What’s your core value proposition?',
    'Do you have a summary I can share with my team?',
    'What makes you different from alternatives?',
    'Where can I see case studies or proof?',
  ],
  onboarding: [
    'What should I do first after signing up?',
    'How long does setup usually take?',
    'Where do I find the key settings?',
    'What are common mistakes to avoid?',
  ],
  hr: [
    'Where can I find our time-off policy?',
    'How do I update my personal details?',
    'Who should I contact for payroll questions?',
    'What’s the process for internal requests?',
  ],
  legal: [
    'What are the key terms I should know?',
    'How is my data handled?',
    'Where can I read your policies?',
    'What are the limitations of this assistant?',
  ],
  finance: [
    'How do invoices and payments work?',
    'Where can I find pricing details?',
    'How do I update billing information?',
    'Who handles refunds or credits?',
  ],
  operations: [
    'What’s the standard process for this request?',
    'What are your typical response times?',
    'How do I track status on an open item?',
    'Who owns the next step?',
  ],
  product: [
    'What are the main features I should know?',
    'How does this integrate with my stack?',
    'What are known limitations?',
    'Where can I learn best practices?',
  ],
  education: [
    'Can you explain this topic in simple steps?',
    'What should I practice first?',
    'How do I check my understanding?',
    'Where can I go deeper on this?',
  ],
  healthcare: [
    'What general information can you provide?',
    'How should I prepare for an appointment?',
    'Where can I find official resources?',
    'When should I speak to a professional?',
  ],
  ecommerce: [
    'Where is my order?',
    'What is your return policy?',
    'How do I change my shipping address?',
    'Can you help me choose the right product?',
  ],
  compliance: [
    'What policies apply to my situation?',
    'How is sensitive data protected?',
    'What audit or reporting options exist?',
    'When should this be escalated to a human?',
  ],
  documentation: [
    'How do I complete the basic setup?',
    'Where is this documented?',
    'What are common troubleshooting steps?',
    'Can you summarize the API or key concepts?',
  ],
  general: [
    'What can you help me with?',
    'How do I get started?',
    'What are the most common questions?',
    'How do I contact your team?',
  ],
};

export function buildTrialExampleQuestions(
  agentName: string,
  primaryCategoryId: string,
  what: string,
  weak: boolean,
): string[] {
  const id = String(primaryCategoryId ?? '').trim().toLowerCase() || 'general';
  const defaults = CATEGORY_EXAMPLE_QUESTIONS[id] ?? CATEGORY_EXAMPLE_QUESTIONS.general;
  const name = String(agentName ?? '').trim() || 'this assistant';

  if (weak) {
    return defaults.slice(0, 4);
  }

  const core = what.trim();
  const short = core.length > 90 ? `${core.slice(0, 87)}…` : core;
  const tailored: string[] = [
    `Based on what ${name} does, what’s the first thing I should know?`,
    `Can you summarize how you help in one paragraph?`,
    short.length >= 20 ? `Can you expand on: “${short}”` : defaults[0],
    `What should I ask next to get the most value?`,
  ];
  const out = tailored.map((q) => q.trim()).filter(Boolean);
  const merged = [...out];
  for (const d of defaults) {
    if (merged.length >= 4) break;
    if (!merged.includes(d)) merged.push(d);
  }
  return merged.slice(0, 4);
}

export type TrialMenuQuickLink = { text: string; route: string; icon?: string };

/** Full visitor-trial chatUI aligned with {@link BotChatUI} defaults + profile-driven fields. */
export function buildTrialVisitorChatUIPreset(input: {
  primaryColor: string;
  launcherAvatarUrl: string;
  menuQuickLinks: TrialMenuQuickLink[];
}): Record<string, unknown> {
  const primaryColor =
    typeof input.primaryColor === 'string' && input.primaryColor.trim().startsWith('#')
      ? input.primaryColor.trim().slice(0, 32)
      : '#14B8A6';
  const launcherAvatarUrl = String(input.launcherAvatarUrl ?? '').trim().slice(0, 2000);
  const links = (input.menuQuickLinks ?? []).slice(0, 10).map((l) => ({
    text: l.text.trim().slice(0, 80),
    route: l.route.trim().slice(0, 2000),
    ...(l.icon ? { icon: String(l.icon).slice(0, 64) } : {}),
  }));

  return {
    primaryColor,
    backgroundStyle: 'light',
    bubbleBorderRadius: 20,
    chatPanelBorderWidth: 1,
    launcherPosition: 'bottom-right',
    shadowIntensity: 'low',
    showChatBorder: true,
    launcherIcon: 'default',
    launcherAvatarUrl,
    launcherAvatarRingWidth: 0,
    launcherSize: 48,
    launcherWhenOpen: 'chevron-down',
    chatOpenAnimation: 'expand',
    openChatOnLoad: false,
    composerBorderWidth: 1,
    composerBorderColor: 'default',
    showBranding: true,
    brandingMessage: 'Powered by Assistrio',
    showPrivacyText: true,
    privacyText: 'This is a trial AI agent.',
    liveIndicatorStyle: 'dot-only',
    statusIndicator: 'live',
    statusDotStyle: 'static',
    showScrollToBottom: true,
    showScrollToBottomLabel: true,
    scrollToBottomLabel: '',
    showScrollbar: true,
    composerAsSeparateBox: true,
    showMenuExpand: true,
    showMenuQuickLinks: true,
    menuQuickLinks: links,
    menuQuickLinksMenuIcon: 'link-2',
    showComposerWithSuggestedQuestions: true,
    showAvatarInHeader: true,
    senderName: '',
    showSenderName: true,
    showTime: true,
    showCopyButton: true,
    showSources: false,
    timePosition: 'top',
    showEmoji: true,
    allowFileUpload: false,
    showMic: false,
  };
}

export function buildDefaultTrialLeadCapture(): BotLeadCaptureV2 {
  return {
    enabled: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone', label: 'Phone number', type: 'phone', required: true },
    ],
    askStrategy: 'balanced',
  };
}
