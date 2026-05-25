/** Customer-app invite link path (token appended by caller). */
export function buildWorkspaceInviteUrl(customerAppBaseUrl: string, plainToken: string): string {
  const base = String(customerAppBaseUrl ?? '').trim().replace(/\/$/, '');
  const token = String(plainToken ?? '').trim();
  if (!base || !token) return '';
  return `${base}/invite/${encodeURIComponent(token)}`;
}

export function shouldExposeWorkspaceInviteUrl(nodeEnv: string | undefined): boolean {
  return String(nodeEnv ?? 'development').trim().toLowerCase() !== 'production';
}
