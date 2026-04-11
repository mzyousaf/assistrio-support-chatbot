"use client";

import type { ReactNode } from "react";

const DEFAULT_WELCOME_MESSAGE = "Hi! \u{1F44B} I'm {{Name}} — {{Tagline}}. How can I help you today?";

export const TRIAL_WELCOME_VARIABLES = [
  { label: "Name", value: "{{Name}}" },
  { label: "Tagline", value: "{{Tagline}}" },
  { label: "Description", value: "{{description}}" },
] as const;

export { DEFAULT_WELCOME_MESSAGE };

const WELCOME_VAR_REGEX = /\{\{Name\}\}|\{\{Tagline\}\}|\{\{description\}\}/g;

export function TrialWelcomeMessagePreview({ text }: { text: string }) {
  const parts = text.split(WELCOME_VAR_REGEX);
  const tokens = text.match(WELCOME_VAR_REGEX) ?? [];
  const labels: Record<string, string> = {
    "{{Name}}": "Name",
    "{{Tagline}}": "Tagline",
    "{{description}}": "Description",
  };
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(<span key={`p-${i}`}>{part}</span>);
    const token = tokens[i];
    if (token)
      nodes.push(
        <span
          key={`v-${i}`}
          className="inline-flex items-center rounded border border-teal-200 bg-teal-50 px-1 py-0.5 text-[10px] font-medium text-teal-900"
        >
          {labels[token] ?? token}
        </span>,
      );
  });
  return <span className="inline">{nodes}</span>;
}
