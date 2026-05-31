import type { BillingPlanKey } from '@/pages/billing/billingPlanComparisonCopy';
import { CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT } from '@/lib/customerAgentTerminology';
import {
  TABLE_FEATURE_HINTS,
  TRIAL_CREDITS_NOTE,
} from '@/pages/billing/billingPlanComparisonCopy';

export type PlanModalTooltipConfig = {
  bullets: readonly string[];
  footer?: string;
};

const PLAN_MODAL_FEATURE_TOOLTIPS: Record<string, PlanModalTooltipConfig> = {
  'Voice messages': {
    bullets: [
      'Visitors can record voice notes in the chat widget.',
      'Audio is transcribed into text before the agent replies.',
      'Each voice message costs 2 AI credits.',
    ],
  },
  Dictation: {
    bullets: [
      'Visitors can dictate into the message box instead of typing.',
      'Each dictation pass in a message is counted separately.',
      'Each dictation pass costs 0.25 AI credits.',
    ],
  },
  Attachments: {
    bullets: ['Visitors can attach files such as images and PDFs in chat.'],
  },
  'Language adaptation': {
    bullets: [
      'The agent can adapt replies to the visitor’s language.',
      'Uses AI credits like other chat messages.',
    ],
  },
  'Topic analytics': {
    bullets: [
      'See which conversation topics come up most often.',
      'Free includes limited history; paid plans are unlimited.',
    ],
  },
  'Sentiment analytics': {
    bullets: [
      'Track positive, neutral, and negative tone in conversations.',
      'Free includes limited history; paid plans are unlimited.',
    ],
  },
  'Auto-train agent': {
    bullets: [
      'Automatically queues new and updated knowledge for training.',
      'Runs on your training schedule without manual steps each time.',
    ],
  },
  'Iframe/embed widget': {
    bullets: [
      'Embed the full chat panel on your site with an iframe.',
      'Only works on website origins you allow in agent settings.',
    ],
  },
};

const AI_CREDITS_PAID_TOOLTIP: PlanModalTooltipConfig = {
  bullets: ['Credits are used for chat replies, voice, dictation, and other AI-powered features.'],
};

const AI_CREDITS_FREE_TOOLTIP: PlanModalTooltipConfig = {
  bullets: [TRIAL_CREDITS_NOTE, ...AI_CREDITS_PAID_TOOLTIP.bullets],
};

function bulletsFromHints(feature: string, featureHint?: readonly string[]): readonly string[] | null {
  const hints = featureHint ?? TABLE_FEATURE_HINTS[feature];
  if (!hints?.length) return null;
  return hints;
}

/** Tooltip copy for core-limit rows in PlansModal (except trained knowledge). */
export function resolvePlanModalLimitTooltip(
  feature: string,
  planKey: BillingPlanKey,
  featureHint?: readonly string[],
): PlanModalTooltipConfig | null {
  if (feature === CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT) {
    return null;
  }

  if (feature === 'AI credits' || feature === 'AI credits / month') {
    return planKey === 'free' ? AI_CREDITS_FREE_TOOLTIP : AI_CREDITS_PAID_TOOLTIP;
  }

  const hints = bulletsFromHints(feature, featureHint);
  return hints ? { bullets: hints } : null;
}

/** Tooltip copy for feature-grid rows in PlansModal. */
export function resolvePlanModalFeatureTooltip(
  feature: string,
  _planKey: BillingPlanKey,
  featureHint?: readonly string[],
): PlanModalTooltipConfig | null {
  const dedicated = PLAN_MODAL_FEATURE_TOOLTIPS[feature];
  if (dedicated) return dedicated;

  const hints = bulletsFromHints(feature, featureHint);
  return hints ? { bullets: hints } : null;
}
