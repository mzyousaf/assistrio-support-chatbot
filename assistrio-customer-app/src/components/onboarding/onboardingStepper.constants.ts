import type { OnboardingStepPath } from '../../onboarding/onboardingState';

export type OnboardingStepDisplay = {
  /** Route segment under `/onboarding/` (unchanged in Epic 3 Step 2). */
  id: OnboardingStepPath;
  title: string;
  subtitle: string;
  /** Merged step guidance — inline on the current step; tooltip on other steps. */
  description: string;
};

/** Display copy for the vertical onboarding stepper (route IDs unchanged). */
export const ONBOARDING_STEP_DISPLAY: readonly OnboardingStepDisplay[] = [
  {
    id: 'agent-profile',
    title: 'Profile',
    subtitle: 'Name, look & feel',
    description:
      "Set your AI Agent's name, avatar, category, and basic appearance. This is how your agent appears to your team and customers.",
  },
  {
    id: 'describe-profile',
    title: 'Describe Your AI Agent',
    subtitle: 'What it helps people with',
    description:
      "Describe what your agent should do, how it should answer, and what kind of support it should provide. These instructions guide your agent's behavior.",
  },
  {
    id: 'knowledge-base',
    title: 'Knowledge Base',
    subtitle: 'Text snippets, Q&A & files',
    description:
      'One snippet, Q&A pair, or file is enough to start — even a PDF or policy doc. Add more anytime; everything here is wired into your agent automatically.',
  },
  {
    id: 'go-live',
    title: 'Go live',
    subtitle: 'Publish on your website',
    description:
      'Choose the website where your AI Agent will appear. This helps protect your widget so it only runs where allowed.',
  },
] as const;
