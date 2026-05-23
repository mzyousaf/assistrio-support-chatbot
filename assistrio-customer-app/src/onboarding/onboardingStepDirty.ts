import type { WorkspaceOnboardingDraftProfile } from '@/api/types';
import {
  agentAvatarStateFromDraft,
  type AgentAvatarState,
} from '@/components/agent/AgentAvatarField';
import {
  categoriesToPayload,
  parseCategoriesForEditor,
  type AgentCategoryValue,
} from '@/components/agent/categoryUtils';
import { normalizePrimaryColor } from '@/lib/primaryColorNormalize';
import { getAgentInstructionsFromDraft } from './agentInstructions';

function sortedCategories(values: string[]): string[] {
  return values.map((v) => v.trim().toLowerCase()).filter(Boolean).sort();
}

export function isAgentProfileStepDirty(args: {
  name: string;
  tagline: string;
  brandColor: string;
  category: AgentCategoryValue;
  avatar: AgentAvatarState;
  profile: WorkspaceOnboardingDraftProfile | null | undefined;
}): boolean {
  const { name, tagline, brandColor, category, avatar, profile } = args;
  if (!profile) {
    return (
      name.trim().length > 0 ||
      tagline.trim().length > 0 ||
      avatar.pendingFile !== null ||
      avatar.avatarSource !== 'none'
    );
  }

  const savedName = String(profile.name ?? '').trim();
  const savedTagline = String(profile.shortDescription ?? '').trim();
  const savedBrand = normalizePrimaryColor(profile.brandColor || brandColor);
  const localBrand = normalizePrimaryColor(brandColor);

  if (name.trim() !== savedName) return true;
  if (tagline.trim() !== savedTagline) return true;
  if (localBrand !== savedBrand) return true;

  const savedCategories = sortedCategories(
    Array.isArray(profile.categories) ? profile.categories.map(String) : [],
  );
  const localCategories = sortedCategories(categoriesToPayload(category));
  if (JSON.stringify(localCategories) !== JSON.stringify(savedCategories)) return true;

  if (avatar.pendingFile) return true;

  const savedAvatar = agentAvatarStateFromDraft(profile);
  if (avatar.avatarSource !== savedAvatar.avatarSource) return true;
  if (avatar.imageUrl.trim() !== savedAvatar.imageUrl.trim()) return true;

  return false;
}

export function isDescribeStepDirty(args: {
  text: string;
  instructions: { description?: string; systemPrompt?: string } | null | undefined;
}): boolean {
  const saved = getAgentInstructionsFromDraft({ instructions: args.instructions ?? undefined });
  return args.text.trim() !== saved.trim();
}

export function isGoLiveStepDirty(args: {
  origin: string;
  label: string;
  allowedOrigins: Array<{ origin?: string; label?: string }> | null | undefined;
}): boolean {
  const first = args.allowedOrigins?.find((row) => String(row.origin ?? '').trim());
  const savedOrigin = first ? String(first.origin).trim() : '';
  const savedLabel = first && typeof first.label === 'string' ? first.label.trim() : '';
  return args.origin.trim() !== savedOrigin || args.label.trim() !== savedLabel;
}

export function hydrateAgentProfileFromDraft(profile: WorkspaceOnboardingDraftProfile | null | undefined) {
  return {
    name: String(profile?.name ?? ''),
    tagline: String(profile?.shortDescription ?? ''),
    brandColor: normalizePrimaryColor(profile?.brandColor || ''),
    category: parseCategoriesForEditor(Array.isArray(profile?.categories) ? profile.categories : []),
    avatar: agentAvatarStateFromDraft(profile),
  };
}
