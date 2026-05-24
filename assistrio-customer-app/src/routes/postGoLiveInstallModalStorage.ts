export const POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY = 'assistrio_post_go_live_install_modal';

/** @deprecated Legacy bot-id-only key; migrated on read when the new intent key is absent. */
export const POST_GO_LIVE_INSTALL_BOT_SESSION_KEY = 'assistrio_post_go_live_install_bot_id';

export const POST_GO_LIVE_INSTALL_MODAL_INTENT_TTL_MS = 10 * 60 * 1000;

export type PostGoLiveInstallModalIntent = {
  botId: string;
  knowledgeProcessingMessage?: string;
  createdAt: number;
};

export function botIdFromCustomerPathname(pathname: string): string | null {
  const match = pathname.match(/^\/bots\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

export function isPostGoLiveInstallIntentExpired(
  intent: PostGoLiveInstallModalIntent,
  nowMs = Date.now(),
): boolean {
  return nowMs - intent.createdAt > POST_GO_LIVE_INSTALL_MODAL_INTENT_TTL_MS;
}

export function persistPostGoLiveInstallModalIntent(args: {
  botId: string;
  knowledgeProcessingMessage?: string;
  createdAt?: number;
}): void {
  const botId = args.botId.trim();
  if (!botId) return;
  const intent: PostGoLiveInstallModalIntent = {
    botId,
    ...(args.knowledgeProcessingMessage?.trim()
      ? { knowledgeProcessingMessage: args.knowledgeProcessingMessage.trim() }
      : {}),
    createdAt: args.createdAt ?? Date.now(),
  };
  try {
    sessionStorage.setItem(POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY, JSON.stringify(intent));
    sessionStorage.removeItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY);
  } catch {
    /* ignore storage errors */
  }
}

/** Back-compat helper used by onboarding completion navigation. */
export function persistPostGoLiveInstallBotId(botId: string): void {
  persistPostGoLiveInstallModalIntent({ botId });
}

export function readPostGoLiveInstallModalIntent(nowMs = Date.now()): PostGoLiveInstallModalIntent | null {
  try {
    const raw = sessionStorage.getItem(POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PostGoLiveInstallModalIntent>;
      const botId = String(parsed.botId ?? '').trim();
      const createdAt =
        typeof parsed.createdAt === 'number' && Number.isFinite(parsed.createdAt)
          ? parsed.createdAt
          : nowMs;
      if (!botId) return null;
      const intent: PostGoLiveInstallModalIntent = {
        botId,
        createdAt,
        ...(typeof parsed.knowledgeProcessingMessage === 'string' &&
        parsed.knowledgeProcessingMessage.trim()
          ? { knowledgeProcessingMessage: parsed.knowledgeProcessingMessage.trim() }
          : {}),
      };
      if (isPostGoLiveInstallIntentExpired(intent, nowMs)) {
        clearPostGoLiveInstallModalIntent();
        return null;
      }
      return intent;
    }

    const legacyBotId = sessionStorage.getItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY)?.trim();
    if (!legacyBotId) return null;
    const migrated: PostGoLiveInstallModalIntent = { botId: legacyBotId, createdAt: nowMs };
    persistPostGoLiveInstallModalIntent(migrated);
    return migrated;
  } catch {
    return null;
  }
}

export function clearPostGoLiveInstallModalIntent(): void {
  try {
    sessionStorage.removeItem(POST_GO_LIVE_INSTALL_MODAL_SESSION_KEY);
    sessionStorage.removeItem(POST_GO_LIVE_INSTALL_BOT_SESSION_KEY);
  } catch {
    /* ignore storage errors */
  }
}

export function postGoLiveInstallIntentMatchesRoute(
  intent: PostGoLiveInstallModalIntent,
  pathname: string,
): boolean {
  const routeBotId = botIdFromCustomerPathname(pathname);
  if (routeBotId) return routeBotId === intent.botId;
  return pathname === '/bots' || pathname === '/bots/';
}
