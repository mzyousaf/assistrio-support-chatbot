/**
 * Resolve {{Name}}, {{Tagline}}, {{description}} in welcome message template.
 * Used when displaying the welcome message in chat so variables show actual bot values.
 */
export function resolveWelcomeMessage(
  template: string,
  ctx: { name?: string; tagline?: string; description?: string },
): string {
  const name = String(ctx.name ?? "").trim();
  const tagline = String(ctx.tagline ?? "").trim();
  const description = String(ctx.description ?? "").trim();
  return template
    .replace(/\{\{Name\}\}/g, name)
    .replace(/\{\{Tagline\}\}/g, tagline)
    .replace(/\{\{description\}\}/g, description);
}
