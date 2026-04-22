export type BotLifecycleAction = 'publish' | 'draft';

/** Validates `POST .../lifecycle-action` body. */
export function parseBotLifecycleActionBody(body: unknown): { action: BotLifecycleAction } | null {
  if (body == null || typeof body !== 'object') return null;
  const action = (body as { action?: unknown }).action;
  if (action === 'publish' || action === 'draft') {
    return { action };
  }
  return null;
}
