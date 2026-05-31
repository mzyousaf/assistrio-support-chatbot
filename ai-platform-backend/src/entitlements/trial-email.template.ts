import { buildBrandedEmailHtml } from '../email/branded-email-layout';
import { getPlanByKey } from './plan-catalog';

export type TrialEmailContent = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ctaButton(label: string, href: string): string {
  const safeLabel = escapeHtml(label);
  const safeHref = escapeHtml(href);
  return `<p style="margin:24px 0 0;"><a href="${safeHref}" style="display:inline-block;background-color:#0d9488;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">${safeLabel}</a></p>`;
}

function wrapEmail(bodyHtml: string, bodyText: string): Pick<TrialEmailContent, 'html' | 'text'> {
  return {
    html: buildBrandedEmailHtml({ contentHtml: bodyHtml }),
    text: bodyText,
  };
}

export function buildTrialStartedEmail(input: {
  workspaceName: string;
  trialEndLabel: string;
  appUrl: string;
  billingUrl: string;
}): TrialEmailContent {
  const trialCredits = getPlanByKey('free').monthlyAiCredits;
  const workspaceName = escapeHtml(input.workspaceName);
  const trialEndLabel = escapeHtml(input.trialEndLabel);
  const appUrl = input.appUrl.trim();
  const billingUrl = input.billingUrl.trim();

  const bodyHtml = [
    '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">',
    `Your 7-day Assistrio trial for <strong>${workspaceName}</strong> is now active.`,
    '</p>',
    '<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">',
    `<li>Trial ends on <strong>${trialEndLabel}</strong></li>`,
    `<li><strong>${trialCredits.toLocaleString()}</strong> trial AI credits included</li>`,
    '<li>Trial credits do not renew</li>',
    '</ul>',
    ctaButton('Open Assistrio', appUrl),
  ].join('');

  const text = [
    `Your 7-day Assistrio trial for ${input.workspaceName} is now active.`,
    '',
    `Trial ends on ${input.trialEndLabel}.`,
    `${trialCredits} trial AI credits included.`,
    'Trial credits do not renew.',
    '',
    `Open Assistrio: ${appUrl}`,
  ].join('\n');

  const wrapped = wrapEmail(bodyHtml, text);
  return {
    subject: 'Welcome to Assistrio — your 7-day trial has started',
    ...wrapped,
  };
}

export function buildTrialEndingSoonEmail(input: {
  workspaceName: string;
  trialEndLabel: string;
  billingUrl: string;
}): TrialEmailContent {
  const workspaceName = escapeHtml(input.workspaceName);
  const trialEndLabel = escapeHtml(input.trialEndLabel);
  const billingUrl = input.billingUrl.trim();

  const bodyHtml = [
    '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">',
    `Your Assistrio trial for <strong>${workspaceName}</strong> ends soon.`,
    '</p>',
    `<p style="margin:0 0 16px;color:#334155;line-height:1.6;">Trial ends on <strong>${trialEndLabel}</strong>. Upgrade to keep AI chat active after your trial.</p>`,
    ctaButton('View plans', billingUrl),
  ].join('');

  const text = [
    `Your Assistrio trial for ${input.workspaceName} ends soon.`,
    '',
    `Trial ends on ${input.trialEndLabel}.`,
    'Upgrade to keep AI chat active after your trial.',
    '',
    `View plans: ${billingUrl}`,
  ].join('\n');

  const wrapped = wrapEmail(bodyHtml, text);
  return {
    subject: 'Your Assistrio trial ends soon',
    ...wrapped,
  };
}

export function buildTrialExpiredEmail(input: {
  workspaceName: string;
  billingUrl: string;
}): TrialEmailContent {
  const workspaceName = escapeHtml(input.workspaceName);
  const billingUrl = input.billingUrl.trim();

  const bodyHtml = [
    '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">',
    `Your free trial for <strong>${workspaceName}</strong> has ended.`,
    '</p>',
    '<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">',
    '<li>AI chat is paused until you upgrade</li>',
    '<li>Your workspace, agents, and knowledge are not deleted</li>',
    '</ul>',
    ctaButton('Upgrade now', billingUrl),
  ].join('');

  const text = [
    `Your free trial for ${input.workspaceName} has ended.`,
    '',
    'AI chat is paused until you upgrade.',
    'Your workspace, agents, and knowledge are not deleted.',
    '',
    `Upgrade now: ${billingUrl}`,
  ].join('\n');

  const wrapped = wrapEmail(bodyHtml, text);
  return {
    subject: 'Your Assistrio trial has ended',
    ...wrapped,
  };
}

export function buildTrialCreditsUsedEmail(input: {
  workspaceName: string;
  billingUrl: string;
}): TrialEmailContent {
  const trialCredits = getPlanByKey('free').monthlyAiCredits;
  const workspaceName = escapeHtml(input.workspaceName);
  const billingUrl = input.billingUrl.trim();

  const bodyHtml = [
    '<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#0f172a;">',
    `You have used all <strong>${trialCredits.toLocaleString()}</strong> trial AI credits for <strong>${workspaceName}</strong>.`,
    '</p>',
    '<p style="margin:0 0 16px;color:#334155;line-height:1.6;">Upgrade to continue chatting before your trial ends.</p>',
    ctaButton('View plans', billingUrl),
  ].join('');

  const text = [
    `You have used all ${trialCredits} trial AI credits for ${input.workspaceName}.`,
    '',
    'Upgrade to continue chatting before your trial ends.',
    '',
    `View plans: ${billingUrl}`,
  ].join('\n');

  const wrapped = wrapEmail(bodyHtml, text);
  return {
    subject: "You've used your trial AI credits",
    ...wrapped,
  };
}
