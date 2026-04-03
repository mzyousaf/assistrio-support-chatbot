import type { EditorTabValue } from "@/lib/agent-slug-to-tab";

export type ReadinessRow = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
  tab: EditorTabValue;
};

export type LaunchReadinessModel = {
  required: ReadinessRow[];
  recommended: ReadinessRow[];
  requiredDone: number;
  requiredTotal: number;
  requiredPct: number;
  recommendedDone: number;
  recommendedTotal: number;
};

export type LaunchReadinessInput = {
  name: string;
  description: string;
  hasAllowedEmbedDomain: boolean;
  hasWelcomeConfigured: boolean;
  hasKnowledgeSources: boolean;
  hasExampleQuestions: boolean;
  hasFaqs: boolean;
};

export function computeLaunchReadiness(input: LaunchReadinessInput): LaunchReadinessModel {
  const required: ReadinessRow[] = [
    {
      id: "name",
      label: "Agent name",
      ok: Boolean(input.name.trim()),
      hint: "Add a name in Profile.",
      tab: "general",
    },
    {
      id: "description",
      label: "Description",
      ok: Boolean(input.description.trim()),
      hint: "Add a description in Profile.",
      tab: "general",
    },
    {
      id: "embed-domain",
      label: "Allowed embed domain",
      ok: input.hasAllowedEmbedDomain,
      hint: "Add an allowed domain in Publish.",
      tab: "publish",
    },
  ];

  const recommended: ReadinessRow[] = [
    {
      id: "knowledge",
      label: "Knowledge sources",
      ok: input.hasKnowledgeSources,
      hint: "Upload documents or add FAQs in Knowledge.",
      tab: "knowledge",
    },
    {
      id: "welcome",
      label: "Welcome message",
      ok: input.hasWelcomeConfigured,
      hint: "Set a welcome message in Chat.",
      tab: "chat-experience",
    },
    {
      id: "starters",
      label: "Starter prompts",
      ok: input.hasExampleQuestions,
      hint: "Add suggested questions in Chat.",
      tab: "chat-experience",
    },
    {
      id: "faqs",
      label: "FAQs in knowledge",
      ok: input.hasFaqs,
      hint: "Add FAQs in Knowledge.",
      tab: "knowledge",
    },
  ];

  const requiredDone = required.filter((r) => r.ok).length;
  const requiredTotal = required.length;
  const recommendedDone = recommended.filter((r) => r.ok).length;
  const recommendedTotal = recommended.length;

  return {
    required,
    recommended,
    requiredDone,
    requiredTotal,
    requiredPct: requiredTotal ? Math.round((requiredDone / requiredTotal) * 100) : 0,
    recommendedDone,
    recommendedTotal,
  };
}
