import type { PublicBotListItem } from "@/types/bot";

function firstSentence(text: string): string {
  const t = text.trim();
  const m = t.match(/^(.+?[.!?])(?:\s+[\s\S]*)?$/);
  return (m?.[1]?.trim() ?? t).slice(0, 200);
}

function buildHelpsWithLine(bot: PublicBotListItem): string | null {
  const blob = `${bot.shortDescription ?? ""} ${bot.exampleQuestions.join(" ")}`.toLowerCase();
  const themes: string[] = [];
  const checks: [RegExp, string][] = [
    [/onboard|getting started|set\s*up/i, "onboarding"],
    [/plan|pricing|subscription|tier/i, "plans"],
    [/doc|documentation|guide|kb|knowledge|article/i, "documentation"],
    [/bill|invoice|payment|refund/i, "billing"],
    [/account|profile|sign[\s-]?in|password/i, "accounts"],
    [/faq|help\s*center|self[\s-]?service/i, "self-service"],
    [/integration|api|webhook/i, "integrations"],
  ];
  for (const [re, label] of checks) {
    if (re.test(blob) && !themes.includes(label)) themes.push(label);
  }
  if (themes.length >= 3) {
    const [a, b, c] = themes;
    return `Helps customers with ${a}, ${b}, and ${c} support.`;
  }
  if (themes.length === 2) {
    const [a, b] = themes;
    return `Helps customers with ${a} and ${b} — ready for live visitors.`;
  }
  if (themes.length === 1) {
    return `Helps customers with ${themes[0]} and related questions — explore prompts below.`;
  }
  return null;
}

function fallbackHeadlineWithoutDescription(bot: PublicBotListItem): string {
  const cat = bot.category?.trim();
  const qs = bot.exampleQuestions.map((q) => q.trim()).filter(Boolean);
  const helps = buildHelpsWithLine(bot);
  if (helps) return helps;
  if (cat && qs.length >= 2) {
    return `Helps customers with ${cat.toLowerCase()}, onboarding, and day-to-day support — sample questions below show what you can ask.`;
  }
  if (qs.length >= 2) {
    return "Helps visitors with common support questions — use the sample prompts below to compare tone and coverage.";
  }
  if (qs.length === 1) {
    const q = qs[0];
    const short = q.length > 120 ? `${q.slice(0, 117)}…` : q;
    return `Answering questions like “${short}” — open the live agent to go deeper.`;
  }
  if (cat) {
    return `An AI Support Agent for ${cat.toLowerCase()} — try the live showcase to experience responses in context.`;
  }
  return "Instant, conversational support for your visitors — explore sample prompts and open the live agent when you are ready.";
}

function buildSubline(bot: PublicBotListItem, hasDescription: boolean): string | undefined {
  const links = (bot.chatUI?.menuQuickLinks ?? []).filter((l) => l.text?.trim());
  if (links.length > 0) {
    const labels = links.slice(0, 3).map((l) => l.text.trim());
    const extra = links.length > 3 ? ` · +${links.length - 3}` : "";
    return `In-chat menu: ${labels.join(" · ")}${extra}`;
  }

  const qs = bot.exampleQuestions.map((q) => q.trim()).filter(Boolean);
  const blob = qs.join(" ").toLowerCase();
  if (hasDescription && qs.length >= 2) {
    const hints: string[] = [];
    if (/account|sign|profile/i.test(blob)) hints.push("accounts");
    if (/plan|upgrade|pricing|subscription/i.test(blob)) hints.push("plans");
    if (/integration|connect/i.test(blob)) hints.push("integrations");
    if (/knowledge|doc|faq|base/i.test(blob)) hints.push("documentation");
    if (hints.length >= 2) {
      return `Sample prompts reflect ${hints.slice(0, 3).join(", ")} — open the demo for full context.`;
    }
  }
  return undefined;
}

export type ValueParts = { headline: string; subline?: string };

/**
 * Headline + optional subline using shortDescription, menuQuickLinks, and exampleQuestions.
 */
export function deriveValueParts(bot: PublicBotListItem): ValueParts {
  const raw = bot.shortDescription?.trim() ?? "";
  let headline: string;
  if (raw) {
    headline = firstSentence(raw);
    if (headline.length > 190) headline = `${headline.slice(0, 187)}…`;
  } else {
    headline = fallbackHeadlineWithoutDescription(bot);
  }

  const subline = buildSubline(bot, !!raw);
  return { headline, subline };
}

/** Headline only — for search or simple previews. */
export function deriveValueStatement(bot: PublicBotListItem): string {
  return deriveValueParts(bot).headline;
}
