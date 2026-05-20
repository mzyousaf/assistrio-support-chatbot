import type { AdminBotWorkspaceBot } from '@/api/types';

/** Paths used when users upload avatar files to platform storage. */
const USER_AVATAR_UPLOAD_PATH = /\/uploads\/bot-avatars\//i;

/**
 * User-uploaded avatars are stored under `uploads/bot-avatars/` — always treat as real image, never as "empty stock".
 */
export function isUserUploadedAvatarUrl(url: string): boolean {
  return USER_AVATAR_UPLOAD_PATH.test(url.trim());
}

/**
 * Legacy empty-state images hosted on Assistrio domains (not user uploads).
 * Upload endpoints use `uploads/bot-avatars/` which must NOT match here.
 */
export function isLegacyStockAssistrioAvatarUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return true;
  if (isUserUploadedAvatarUrl(u)) return false;
  return /assistrio\.(com|io|app)/i.test(u) || /^https?:\/\/cdn\.assistrio/i.test(u.trim());
}

export type BotAvatarSource = 'upload' | 'url' | 'emoji' | 'none';

/**
 * Effective avatar mode from API fields (legacy bots may omit `avatarSource`).
 */
export function inferBotAvatarSource(
  b: Pick<AdminBotWorkspaceBot, 'imageUrl' | 'avatarEmoji'> & Partial<Pick<AdminBotWorkspaceBot, 'avatarSource'>>,
): BotAvatarSource {
  const s = b.avatarSource;
  if (s === 'upload' || s === 'url' || s === 'emoji' || s === 'none') return s;
  const url = String(b.imageUrl ?? '').trim();
  const emoji = String(b.avatarEmoji ?? '').trim();
  if (emoji.length && !url) return 'emoji';
  if (url) {
    if (isUserUploadedAvatarUrl(url)) return 'upload';
    return 'url';
  }
  if (emoji.length) return 'emoji';
  return 'none';
}

const MAX_GRAPHEME_EMOJI = 2;

/** Prefer grapheme segmentation when available (combined emoji, skin tones). */
export function clampAvatarEmojiInput(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return [...seg.segment(t)]
        .slice(0, MAX_GRAPHEME_EMOJI)
        .map((x) => x.segment)
        .join('');
    } catch {
      /* fall through */
    }
  }
  return Array.from(t).slice(0, MAX_GRAPHEME_EMOJI).join('');
}
