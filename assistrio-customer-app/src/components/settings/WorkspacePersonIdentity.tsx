import { useEffect, useState } from 'react';
import {
  formatWorkspaceMemberName,
  resolveWorkspaceMemberAvatarUrl,
} from '@/lib/workspaceMembersMessages';
import { cn } from '@/lib/utils';

/** Shared person fields used by Members table and Share agent access modal. */
export type WorkspacePersonProfile = {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
};

export function workspacePersonInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed && trimmed !== email) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0].slice(0, 1).toUpperCase();
  }
  const local = email.split('@')[0] || '';
  const segments = local.split(/[._-]+/).filter(Boolean);
  if (segments.length >= 2) return (segments[0][0] + segments[1][0]).toUpperCase();
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return (local[0] || '?').toUpperCase();
}

export function resolveWorkspacePersonName(profile: WorkspacePersonProfile): string {
  return formatWorkspaceMemberName({
    email: profile.email,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    displayName: profile.displayName ?? null,
  });
}

export function botAccessGrantRowToProfile(row: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
}): WorkspacePersonProfile {
  return {
    email: row.email,
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    displayName: row.displayName ?? null,
    avatarUrl: row.avatarUrl ?? null,
    picture: row.picture ?? null,
  };
}

export function WorkspacePersonAvatar({
  profile,
  size = 'md',
  className,
}: {
  profile: WorkspacePersonProfile;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const name = resolveWorkspacePersonName(profile);
  const resolvedUrl = resolveWorkspaceMemberAvatarUrl(profile);
  const initials = workspacePersonInitials(name, profile.email);
  const [imgFailed, setImgFailed] = useState(false);
  const dim = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]';
  const ring = size === 'sm' ? 'ring-2 ring-white' : 'ring-1 ring-slate-200/80';

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedUrl]);

  if (resolvedUrl && !imgFailed) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn('block shrink-0 rounded-full object-cover', dim, ring, className)}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600',
        dim,
        ring,
        className,
      )}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function WorkspacePersonIdentity({ profile }: { profile: WorkspacePersonProfile }) {
  const name = resolveWorkspacePersonName(profile);
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <WorkspacePersonAvatar profile={profile} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{name}</div>
        {name !== profile.email ? (
          <div className="truncate text-xs text-slate-500">{profile.email}</div>
        ) : null}
      </div>
    </div>
  );
}
