/**
 * Customer insights conversation URL with optional message deep link (lead source message).
 */
export function customerConversationInsightsPath(
  botId: string,
  conversationId: string,
  messageId?: string | null,
): string {
  const b = encodeURIComponent(botId);
  const q = new URLSearchParams();
  q.set('conversationId', conversationId);
  const m = messageId?.trim();
  if (m) q.set('messageId', m);
  return `/bots/${b}/insights/conversations?${q.toString()}`;
}
