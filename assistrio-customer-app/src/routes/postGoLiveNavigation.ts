import { CUSTOMER_ROUTES } from './customerRoutes';

/** Bot workspace root (`/bots/:id`); index redirects to playground profile. */
export function customerBotWorkspacePath(botId: string): string {
  const id = botId.trim();
  return `${CUSTOMER_ROUTES.agents}/${encodeURIComponent(id)}`;
}

/** Default bot workspace landing route after onboarding go-live. */
export function customerBotPlaygroundPath(botId: string): string {
  return `${customerBotWorkspacePath(botId)}/playground`;
}

/** Full default child route (playground profile tab). */
export function customerBotDefaultWorkspacePath(botId: string): string {
  return `${customerBotPlaygroundPath(botId)}/profile`;
}

export type PostGoLiveInstallQuery = {
  showInstall?: boolean;
  liveBotId?: string;
};

/** Query string for the post–go-live install modal (`showInstall=1` + `liveBotId`). */
export function postGoLiveInstallSearchParams(
  botId: string,
  opts?: { showInstall?: boolean },
): URLSearchParams {
  const id = botId.trim();
  const params = new URLSearchParams();
  if (opts?.showInstall !== false && id) {
    params.set('showInstall', '1');
    params.set('liveBotId', id);
  }
  return params;
}

/** Preferred destination after onboarding go-live: bot playground with install modal params. */
export function postOnboardingGoLiveBotDestination(
  botId: string,
  opts?: { showInstall?: boolean },
): string {
  const id = botId.trim();
  if (!id) return CUSTOMER_ROUTES.agents;
  const params = postGoLiveInstallSearchParams(id, opts);
  const qs = params.toString();
  const base = customerBotPlaygroundPath(id);
  return qs ? `${base}?${qs}` : base;
}

/** Fallback when the bot workspace cannot be loaded after go-live. */
export function postOnboardingGoLiveBotsListFallback(botId: string): string {
  const id = botId.trim();
  if (!id) return CUSTOMER_ROUTES.agents;
  const params = postGoLiveInstallSearchParams(id);
  return `${CUSTOMER_ROUTES.agents}?${params.toString()}`;
}
