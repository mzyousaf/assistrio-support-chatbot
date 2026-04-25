/**
 * Whether the stored welcome template should appear in the widget or be seeded into new conversations.
 * When `welcomeMessageEnabled === false`, text may still be stored for editors to re-enable later.
 * Legacy documents omit the flag → treat like "on" when message text is non-empty.
 */
export function isWelcomeMessageActive(bot: {
  welcomeMessage?: string | null;
  welcomeMessageEnabled?: boolean | null;
}): boolean {
  if (bot.welcomeMessageEnabled === false) return false;
  const raw = typeof bot.welcomeMessage === 'string' ? bot.welcomeMessage.trim() : '';
  return raw.length > 0;
}
