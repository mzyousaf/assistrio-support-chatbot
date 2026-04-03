import React from "react";

export const DEFAULT_WELCOME_MESSAGE =
  "Hi! 👋 I'm {{Name}} — {{Tagline}}. How can I help you today?";

export const WELCOME_VARIABLES = [
  { label: "Name", value: "{{Name}}" },
  { label: "Tagline", value: "{{Tagline}}" },
  { label: "Description", value: "{{description}}" },
] as const;

const WELCOME_VAR_REGEX = /\{\{Name\}\}|\{\{Tagline\}\}|\{\{description\}\}/g;

export function WelcomeMessagePreview({ text }: { text: string }) {
  const parts = text.split(WELCOME_VAR_REGEX);
  const tokens = text.match(WELCOME_VAR_REGEX) ?? [];
  const labels: Record<string, string> = {
    "{{Name}}": "Name",
    "{{Tagline}}": "Tagline",
    "{{description}}": "Description",
  };
  const nodes: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`p-${i}`}>{part}</span>);
    const token = tokens[i];
    if (token)
      nodes.push(
        <span
          key={`v-${i}`}
          className="inline-flex items-center rounded border border-brand-300 bg-brand-50 px-1 py-0.5 text-[10px] font-medium text-brand-700 dark:border-brand-600 dark:bg-brand-900/50 dark:text-brand-200"
        >
          {labels[token] ?? token}
        </span>,
      );
  });
  return <span className="inline">{nodes}</span>;
}
