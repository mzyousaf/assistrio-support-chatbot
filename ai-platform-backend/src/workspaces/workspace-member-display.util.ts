/** Resolve workspace member list display fields from user profile sources. */
export function resolveWorkspaceMemberDisplayName(user: {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  displayNameOverride?: string | null;
}): string {
  const override = user.displayNameOverride?.trim();
  if (override) return override;
  const parts = [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return String(user.email ?? '').trim();
}

export function resolveWorkspaceMemberAvatarUrl(user: {
  picture?: string | null;
  pictureOverride?: string | null;
}): string | null {
  const override = user.pictureOverride;
  if (override === null) {
    const google = user.picture?.trim();
    return google || null;
  }
  const trimmedOverride = override?.trim();
  if (trimmedOverride) return trimmedOverride;
  const google = user.picture?.trim();
  return google || null;
}
