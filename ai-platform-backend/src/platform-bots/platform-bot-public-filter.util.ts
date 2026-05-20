import { isPlatformBotType } from './platform-bot.util';

/** Mongo match for published public platform bots (anonymous APIs). */
export function buildPlatformBotPublicMongoFilter(query: { type?: string }): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    isPlatformBot: true,
    status: 'published',
    visibility: 'public',
    isPublic: true,
    active: { $ne: false },
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
  if (isPlatformBotType(query.type)) {
    filter.platformBotType = query.type;
  } else {
    filter.platformBotType = { $ne: 'internal' };
  }
  return filter;
}
