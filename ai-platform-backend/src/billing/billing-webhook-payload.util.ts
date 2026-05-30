export function extractWorkspaceIdFromWebhookPayload(
  rawPayload: Record<string, unknown> | null | undefined,
): string | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const meta = rawPayload.meta;
  if (!meta || typeof meta !== 'object') return null;

  const custom = (meta as { custom_data?: Record<string, unknown> }).custom_data;
  if (!custom || typeof custom !== 'object') return null;

  const id = String(custom.workspaceId ?? custom.workspace_id ?? '').trim();
  return id || null;
}
