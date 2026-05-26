/** Short label for document / secondary context (primary chrome is the top navbar). */
export function customerShellSectionTitle(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/') return null;
  if (path === '/usage') return 'Usage';
  if (path.startsWith('/settings/plans') || path === '/plans') return 'Plans';
  if (path.startsWith('/settings/account') || path.startsWith('/settings/general')) return 'General';
  if (path.startsWith('/settings/workspace')) return 'General';
  if (path.startsWith('/settings/members')) return 'Members';
  if (path.startsWith('/settings/billing')) return 'Billing';
  if (path.startsWith('/settings/api-keys')) return 'API keys';
  if (path.startsWith('/settings')) return 'Settings';
  if (path === '/bots') return 'Agents';
  if (path.startsWith('/onboarding')) return 'Setup';

  const workspace = /^\/bots\/[^/]+\/(.+)$/.exec(path);
  if (workspace) {
    const rest = workspace[1];
    if (rest === 'playground/knowledgebase' || rest.startsWith('playground/knowledgebase/')) {
      if (
        rest.startsWith('playground/knowledgebase/overview') ||
        rest === 'playground/knowledgebase'
      ) {
        return 'Agent · Knowledge Overview';
      }
      if (rest.startsWith('playground/knowledgebase/documents')) return 'Agent · Documents';
      if (rest.startsWith('playground/knowledgebase/snippets') || rest === 'playground/knowledgebase/notes')
        return 'Agent · Snippets';
      if (rest.startsWith('playground/knowledgebase/datasheets') || rest === 'playground/knowledgebase/tables')
        return 'Agent · Datasheets';
      if (rest.startsWith('playground/knowledgebase/faqs')) return 'Agent · Q&A';
      if (rest.startsWith('playground/knowledgebase/suggestions')) return 'Agent · Suggestions';
    }
    if (rest === 'knowledge' || rest.startsWith('knowledge/')) {
      if (rest.startsWith('knowledge/overview')) return 'Agent · Knowledge Overview';
      if (rest.startsWith('knowledge/documents')) return 'Agent · Documents';
      if (rest.startsWith('knowledge/snippets') || rest === 'knowledge/notes') return 'Agent · Snippets';
      if (rest.startsWith('knowledge/datasheets') || rest === 'knowledge/tables') return 'Agent · Datasheets';
      if (rest.startsWith('knowledge/faqs')) return 'Agent · Q&A';
      if (rest.startsWith('knowledge/suggestions')) return 'Agent · Suggestions';
    }
    const labels: Record<string, string> = {
      'playground/profile': 'Agent · Profile',
      'playground/behavior': 'Agent · Behavior',
      'playground/ai': 'Agent · AI & Advanced',
      'playground/chat': 'Agent · Chat Experience',
      'playground/appearance': 'Agent · Widget Appearance',
      'playground/deploy': 'Agent · Deploy & Go Live',
      'playground/publish': 'Agent · Deploy & Go Live',
      'knowledge/documents': 'Agent · Documents',
      'knowledge/snippets': 'Agent · Snippets',
      'knowledge/notes': 'Agent · Snippets',
      'knowledge/datasheets': 'Agent · Datasheets',
      'knowledge/tables': 'Agent · Datasheets',
      'knowledge/faqs': 'Agent · Q&A',
      'activity/chat-logs': 'Agent · Chat logs',
      'insights/conversations': 'Agent · Chat logs',
      'activity/leads': 'Agent · Leads',
      'analytics/chats': 'Agent · Analytics',
      'usage': 'Agent · Agent Resources',
      'analytics/leads': 'Agent · Leads analytics',
      'analytics/topics': 'Agent · Topics',
      'analytics/sentiment': 'Agent · Sentiment',
      'analytics/agent-resources': 'Agent · Agent Resources',
    };
    return labels[rest] ?? 'Agent';
  }
  if (/^\/bots\/[^/]+/.test(path)) return 'Agent';

  return null;
}
