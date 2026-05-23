import type { LucideIcon } from 'lucide-react';
import { CheckCircle, Clipboard, Code, ExternalLink, Globe } from 'lucide-react';

/** Workspace navbar publish confirm — existing agent going live. */
export const WORKSPACE_PUBLISH_WHAT_HAPPENS_NEXT = [
  'The install snippet works only on allowed websites you list under Deploy & Go Live.',
  'You can copy the snippet anytime and move back to draft from the nav or this page.',
] as const;

export const WORKSPACE_DRAFT_WHAT_HAPPENS_NEXT = [
  'Each allowed website stops showing this agent in the embed until you publish again.',
  'Your workspace, knowledge, and Deploy & Go Live settings stay as they are.',
] as const;

export type GoLiveWhatHappensNextItem = {
  key: string;
  icon: LucideIcon;
  text: string;
};

/** Onboarding first-time publish confirm — icon per step. */
export function onboardingPublishWhatHappensNextItems(
  normalizedOrigin?: string | null,
): GoLiveWhatHappensNextItem[] {
  return [
    { key: 'publish', icon: CheckCircle, text: 'Your AI Agent will be published.' },
    { key: 'save-origin', icon: Globe, text: 'Your allowed website will be saved.' },
    { key: 'dashboard', icon: Code, text: "You'll be taken to your dashboard." },
    {
      key: 'install-modal',
      icon: ExternalLink,
      text: 'An install modal will open with Widget, Iframe, and Share options.',
    },
    {
      key: 'install-snippet',
      icon: Clipboard,
      text: normalizedOrigin
        ? `Copy the install snippet and paste it on ${normalizedOrigin}.`
        : 'Copy the install snippet and paste it on your allowed website.',
    },
  ];
}
