/** Short label for document / secondary context (primary chrome is the top navbar). */
export function customerShellSectionTitle(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/') return null;
  if (path === '/usage') return 'Usage';
  if (path.startsWith('/settings/plans') || path === '/plans') return 'Plans';
  if (path.startsWith('/settings/general')) return 'General';
  if (path.startsWith('/settings/members')) return 'Members';
  if (path.startsWith('/settings/billing')) return 'Billing';
  if (path.startsWith('/settings/api-keys')) return 'API keys';
  if (path.startsWith('/settings')) return 'Settings';
  if (path === '/bots') return 'Agents';
  if (path.startsWith('/onboarding')) return 'Setup';

  const workspace = /^\/bots\/[^/]+\/(.+)$/.exec(path);
  if (workspace) {
    const rest = workspace[1];
    const labels: Record<string, string> = {
      'playground/profile': 'Agent · Profile',
      'playground/behavior': 'Agent · Behavior',
      'playground/ai': 'Agent · AI & Responses',
      'playground/chat': 'Agent · Chat Experience',
      'playground/appearance': 'Agent · Widget Appearance',
      'playground/deploy': 'Agent · Deploy & Go Live',
      'playground/publish': 'Agent · Deploy & Go Live',
      'knowledge/documents': 'Agent · Documents',
      'knowledge/notes': 'Agent · Notes',
      'knowledge/faqs': 'Agent · Q&A',
      'activity/chat-logs': 'Agent · Conversations',
      'activity/leads': 'Agent · Leads',
      'analytics/chats': 'Agent · Analytics',
      'analytics/topics': 'Agent · Topics',
      'analytics/sentiment': 'Agent · Sentiment',
    };
    return labels[rest] ?? 'Agent';
  }
  if (/^\/bots\/[^/]+/.test(path)) return 'Agent';

  return null;
}
