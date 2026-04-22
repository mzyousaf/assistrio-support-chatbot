import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Matches backend / widget `resolveWelcomeMessage` token names. */
export const WELCOME_KEYWORD_PILLS = [
  { label: 'Name', value: '{{Name}}' },
  { label: 'Tagline', value: '{{Tagline}}' },
  { label: 'Description', value: '{{description}}' },
] as const;

const WELCOME_KEYWORD_REGEX = /\{\{Name\}\}|\{\{Tagline\}\}|\{\{description\}\}/g;

const TOKEN_LABEL: Record<string, string> = {
  '{{Name}}': 'Name',
  '{{Tagline}}': 'Tagline',
  '{{description}}': 'Description',
};

/**
 * Renders template text with Key Word tokens shown as highlighted chips (editor preview).
 */
export function WelcomeMessageKeywordPreview({ text, className }: { text: string; className?: string }) {
  const parts = text.split(WELCOME_KEYWORD_REGEX);
  const tokens = text.match(WELCOME_KEYWORD_REGEX) ?? [];
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`p-${i}`}>{part}</span>);
    const token = tokens[i];
    if (token)
      nodes.push(
        <span
          key={`k-${i}`}
          className="mx-0.5 inline-flex items-center rounded-md border border-[var(--color-teal-600)]/25 bg-[var(--teal-50)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[var(--color-teal-800)]"
        >
          {TOKEN_LABEL[token] ?? token}
        </span>,
      );
  });
  return (
    <span className={cn('inline text-[0.8125rem] leading-relaxed text-slate-800', className)}>
      {nodes.length > 0 ? nodes : <span className="text-slate-400">—</span>}
    </span>
  );
}
