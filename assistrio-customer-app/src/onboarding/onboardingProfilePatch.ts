import {
  resolveAgentAvatarPayload,
  type AgentAvatarState,
} from '@/components/agent/AgentAvatarField';
import {
  categoriesToPayload,
  hasAgentCategorySelection,
  type AgentCategoryValue,
} from '@/components/agent/categoryUtils';
import type { WorkspaceOnboardingDraftProfile } from '@/api/types';
import { normalizePrimaryColor } from '@/lib/primaryColorNormalize';

/** Build a partial PATCH body from local Agent Profile form state (no validation gates). */
export function buildOnboardingProfilePatchBody(args: {
  name: string;
  tagline: string;
  brandColor: string;
  category: AgentCategoryValue;
  avatar: AgentAvatarState;
  draftProfile?: WorkspaceOnboardingDraftProfile | null;
}): Record<string, unknown> | null {
  const n = args.name.trim();
  const tag = args.tagline.trim();
  const avatarFields = resolveAgentAvatarPayload(args.avatar);
  const draftProfile = args.draftProfile;

  const body: Record<string, unknown> = {
    brandColor: normalizePrimaryColor(args.brandColor),
  };

  if (n) body.name = n;
  if (tag) body.shortDescription = tag;
  if (hasAgentCategorySelection(args.category)) {
    body.categories = categoriesToPayload(args.category);
  }

  if (avatarFields.avatarSource) body.avatarSource = avatarFields.avatarSource;
  if (avatarFields.imageUrl) body.imageUrl = avatarFields.imageUrl;
  if (avatarFields.avatarEmoji) body.avatarEmoji = avatarFields.avatarEmoji;
  if (avatarFields.avatarSource === 'upload' && draftProfile?.avatarStorageKey) {
    body.avatarStorageKey = draftProfile.avatarStorageKey;
  } else if (avatarFields.avatarSource === 'none') {
    body.avatarStorageKey = '';
  }

  return Object.keys(body).length > 0 ? body : null;
}
