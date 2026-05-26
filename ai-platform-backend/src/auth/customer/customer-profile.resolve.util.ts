import type { RequestUser } from '../shared/request-user.types';

export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim().replace(/\s+/g, ' ');
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) {
    return { firstName: trimmed, lastName: '' };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx).trim(),
    lastName: trimmed.slice(spaceIdx + 1).trim(),
  };
}

/** Prefer customer-edited overrides over Google-synced profile fields in session payloads. */
export function resolveCustomerSessionProfile(
  user: Pick<
    RequestUser,
    'firstName' | 'lastName' | 'picture' | 'displayNameOverride' | 'pictureOverride'
  >,
): { firstName?: string; lastName?: string; picture?: string } {
  const overrideName = user.displayNameOverride?.trim();
  if (overrideName) {
    const split = splitDisplayName(overrideName);
    return {
      firstName: split.firstName || undefined,
      lastName: split.lastName || undefined,
      picture: resolveCustomerSessionPicture(user),
    };
  }

  return {
    firstName: user.firstName?.trim() || undefined,
    lastName: user.lastName?.trim() || undefined,
    picture: resolveCustomerSessionPicture(user),
  };
}

function resolveCustomerSessionPicture(
  user: Pick<RequestUser, 'picture' | 'pictureOverride'>,
): string | undefined {
  const override = user.pictureOverride;
  if (override === null) {
    return user.picture?.trim() || undefined;
  }
  const trimmedOverride = override?.trim();
  if (trimmedOverride) {
    return trimmedOverride;
  }
  return user.picture?.trim() || undefined;
}
