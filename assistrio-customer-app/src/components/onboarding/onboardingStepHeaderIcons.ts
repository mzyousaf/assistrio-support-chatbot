import { BookOpen, Bot, MessageSquareText, Rocket, type LucideIcon } from 'lucide-react';
import type { OnboardingStepPath } from '../../onboarding/onboardingState';

/** Page-header icons for each onboarding step (eyebrow + title block). */
export const ONBOARDING_STEP_HEADER_ICONS: Record<OnboardingStepPath, LucideIcon> = {
  'agent-profile': Bot,
  'describe-profile': MessageSquareText,
  'knowledge-base': BookOpen,
  'go-live': Rocket,
};
