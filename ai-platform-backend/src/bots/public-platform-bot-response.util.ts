import { isWelcomeMessageActive } from './welcome-message-display.util';
import { exampleQuestionsToPublicLabels } from '../workspace/shared/example-questions.util';
import { isPlatformBotType, type PlatformBotType } from '../platform-bots/platform-bot.util';

export type PublicPlatformBotItem = {
  id: string;
  name: string;
  description?: string | null;
  platformBotType: PlatformBotType;
  avatarUrl?: string | null;
  status: 'published';
  visibility?: 'public';
  accessKey?: string;
  publicSlug?: string | null;
  greeting?: string | null;
  suggestedQuestions?: string[];
  updatedAt?: string | null;
};

function nonEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalDescription(value: unknown): string | null | undefined {
  const v = nonEmpty(value);
  return v ? v : null;
}

/** Map a lean Bot document to the public platform-bot API shape (no secrets beyond accessKey). */
export function shapePublicPlatformBot(raw: Record<string, unknown>): PublicPlatformBotItem | null {
  const id = nonEmpty(raw._id != null ? String(raw._id) : raw.id);
  const name = nonEmpty(raw.name);
  const platformBotTypeRaw = raw.platformBotType;
  if (!id || !name || !isPlatformBotType(platformBotTypeRaw)) return null;
  if (raw.isPlatformBot !== true) return null;
  if (raw.status !== 'published') return null;
  if (raw.visibility !== 'public' && raw.isPublic === false) return null;

  const accessKey = nonEmpty(raw.accessKey);
  const slug = nonEmpty(raw.slug);
  const imageUrl = nonEmpty(raw.imageUrl);
  const greeting = isWelcomeMessageActive(
    raw as { welcomeMessage?: string; welcomeMessageEnabled?: boolean },
  )
    ? nonEmpty(raw.welcomeMessage) || null
    : null;
  const suggestedQuestions = exampleQuestionsToPublicLabels(raw.exampleQuestions);
  const createdAt = raw.createdAt instanceof Date ? raw.createdAt.toISOString() : nonEmpty(raw.createdAt);

  return {
    id,
    name,
    description: optionalDescription(raw.description) ?? optionalDescription(raw.shortDescription),
    platformBotType: platformBotTypeRaw,
    avatarUrl: imageUrl || null,
    status: 'published',
    visibility: 'public',
    ...(accessKey ? { accessKey } : {}),
    publicSlug: slug || null,
    greeting,
    ...(suggestedQuestions.length > 0 ? { suggestedQuestions } : {}),
    updatedAt: createdAt || null,
  };
}

export function shapePublicPlatformBotListResponse(
  rows: Record<string, unknown>[],
): { ok: true; bots: PublicPlatformBotItem[] } {
  const bots = rows
    .map((row) => shapePublicPlatformBot(row))
    .filter((row): row is PublicPlatformBotItem => row !== null);
  return { ok: true, bots };
}

export function shapePublicPlatformBotDetailResponse(
  row: Record<string, unknown> | null,
): { ok: true; bot: PublicPlatformBotItem } | null {
  const bot = row ? shapePublicPlatformBot(row) : null;
  if (!bot) return null;
  return { ok: true, bot };
}
