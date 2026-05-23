import type { WorkspaceOnboardingDraftAllowedOrigin, WorkspaceOnboardingGoLiveBot } from '../api/types';
import { getCustomerApiOrigin } from '../api/client';
import {
  getCustomerAppPublicOrigin,
  iframeEmbedSnippet,
  widgetSnippet,
} from '@/lib/embedOrigin';

export type OnboardingInstallMode = 'chat-widget' | 'iframe' | 'share-preview';

export type OnboardingInstallBot = Pick<
  WorkspaceOnboardingGoLiveBot,
  'accessKey' | 'secretKey' | 'visibility' | 'allowedOrigins' | 'name'
>;

function widgetAssetOrigin(): string {
  return (import.meta.env.VITE_WIDGET_ASSET_ORIGIN ?? '').replace(/\/$/, '') || 'https://widget.assistrio.com';
}

export function buildOnboardingChatWidgetSnippetFromInstallBot(
  bot: OnboardingInstallBot,
  botId: string,
): string {
  const accessKey = String(bot.accessKey ?? '').trim();
  const secretKey = String(bot.secretKey ?? '').trim();
  const visibility = bot.visibility === 'private' ? 'private' : 'public';
  return widgetSnippet({
    botId,
    apiBaseUrl: getCustomerApiOrigin(),
    accessKey,
    visibility,
    widgetAssetOrigin: widgetAssetOrigin(),
    ...(visibility === 'private' && secretKey ? { secretKey } : {}),
  });
}

export function buildOnboardingIframeSnippetFromInstallBot(
  bot: OnboardingInstallBot,
  botId: string,
): string {
  const accessKey = String(bot.accessKey ?? '').trim();
  const secretKey = String(bot.secretKey ?? '').trim();
  const visibility = bot.visibility === 'private' ? 'private' : 'public';
  return iframeEmbedSnippet({
    appOrigin: getCustomerAppPublicOrigin(),
    botId,
    accessKey,
    ...(visibility === 'private' && secretKey ? { secretKey } : {}),
  });
}

export function primaryAllowedOriginFromInstallBot(
  bot: { allowedOrigins?: WorkspaceOnboardingDraftAllowedOrigin[] } | null,
): string {
  const ao = Array.isArray(bot?.allowedOrigins) ? bot!.allowedOrigins! : [];
  const first = ao.find((o) => o.isActive !== false && String(o.origin ?? '').trim());
  return first ? String(first.origin).trim() : '';
}
