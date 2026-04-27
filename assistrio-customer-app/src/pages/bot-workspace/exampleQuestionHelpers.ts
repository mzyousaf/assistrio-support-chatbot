import type { CustomerBotDetail } from '@/api/types';
import { EXAMPLE_QUESTIONS_MAX, EXAMPLE_QUESTION_CONTEXT_MAX, EXAMPLE_QUESTION_MAX_CHARS } from './behaviorConstants';

export type ExampleQuestionItem = { label: string; context: string };

export function hydrateExampleQuestionsFromBot(bot: CustomerBotDetail | null | undefined): ExampleQuestionItem[] {
  const raw = bot?.exampleQuestions;
  if (!Array.isArray(raw)) return [];
  const out: ExampleQuestionItem[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const label = item.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
      if (label) out.push({ label, context: '' });
    } else if (item && typeof item === 'object' && 'label' in item) {
      const o = item as { label?: string; context?: string };
      const label = String(o.label ?? '').trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
      if (!label) continue;
      const context = String(o.context ?? '').trim().slice(0, EXAMPLE_QUESTION_CONTEXT_MAX);
      out.push({ label, context });
    }
    if (out.length >= EXAMPLE_QUESTIONS_MAX) break;
  }
  return out;
}

export function exampleQuestionsToPatchPayload(
  items: ExampleQuestionItem[],
): Array<{ label: string; context?: string }> {
  return items
    .map(({ label, context }) => {
      const l = label.trim().slice(0, EXAMPLE_QUESTION_MAX_CHARS);
      if (!l) return null;
      const c = context.trim();
      if (c) return { label: l, context: c.slice(0, EXAMPLE_QUESTION_CONTEXT_MAX) };
      return { label: l };
    })
    .filter((x): x is { label: string; context?: string } => x != null);
}

export function exampleQuestionLabelsOnly(items: ExampleQuestionItem[]): string[] {
  return items.map((x) => x.label).filter(Boolean);
}
