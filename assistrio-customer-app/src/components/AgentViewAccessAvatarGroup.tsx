import { Share2 } from 'lucide-react';
import type { BotViewAccessPreviewMember } from '@/api/types';
import {
  WorkspacePersonAvatar,
  resolveWorkspacePersonName,
  type WorkspacePersonProfile,
} from '@/components/settings/WorkspacePersonIdentity';
import { Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
const MAX_VISIBLE = 3;
/** Slight overlap between plus / avatars. */
const AVATAR_STACK_OVERLAP = '-ml-1.5';
/** +N tag overlaps the last avatar only a little. */
const OVERFLOW_TAG_OVERLAP = '-ml-1';

type Props = {
  members: BotViewAccessPreviewMember[];
  onAdd: () => void;
};

function toProfile(member: BotViewAccessPreviewMember): WorkspacePersonProfile {
  return {
    email: member.email,
    firstName: member.firstName ?? null,
    lastName: member.lastName ?? null,
    displayName: member.displayName ?? null,
    avatarUrl: member.avatarUrl ?? null,
    picture: member.picture ?? null,
  };
}

export function AgentViewAccessAvatarGroup({ members, onAdd }: Props) {
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, members.length - MAX_VISIBLE);
  const plusZIndex = visible.length + (overflow > 0 ? 1 : 0) + 1;

  return (
    <div
      className="flex shrink-0 items-center"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex items-center">
        <Tooltip content="Share agent access">
          <button
            type="button"
            aria-label={
              members.length > 0
                ? `Share agent access, ${members.length} people with view access`
                : 'Share agent access'
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAdd();
            }}
            className={cn(
              'relative inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--color-teal-600)] bg-white text-[var(--color-teal-700)] ring-2 ring-white shadow-none transition-[background-color,border-color,color] duration-150',
              'hover:border-[var(--color-teal-700)] hover:bg-[var(--teal-50)] hover:text-[var(--color-teal-800)]',
              'active:bg-[color-mix(in_srgb,var(--teal-50)_92%,var(--color-teal-600)_8%)]',
              '[&_svg]:text-[var(--color-teal-600)] hover:[&_svg]:text-[var(--color-teal-700)]',
            )}
            style={{ zIndex: plusZIndex }}
          >
            <Share2 size={11} strokeWidth={2.5} aria-hidden />
          </button>
        </Tooltip>

        {visible.map((member, index) => {
          const profile = toProfile(member);
          const name = resolveWorkspacePersonName(profile);
          return (
            <Tooltip key={`${member.email}-${index}`} content={name}>
              <span
                className={cn('relative inline-flex', AVATAR_STACK_OVERLAP)}
                style={{ zIndex: plusZIndex - 1 - index }}
              >
                <WorkspacePersonAvatar profile={profile} size="sm" />
              </span>
            </Tooltip>
          );
        })}

        {overflow > 0 ? (
          <Tooltip content={`${members.length} people with view access`}>
            <span
              className={cn(
                'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold tabular-nums text-white ring-2 ring-white',
                OVERFLOW_TAG_OVERLAP,
              )}
              style={{ zIndex: 0 }}
            >
              +{overflow}
            </span>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
