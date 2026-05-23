import { BadRequestException } from '@nestjs/common';

export const ONBOARDING_KNOWLEDGE_BULK_DELETE_MAX_IDS = 100;

export function parseOnboardingKnowledgeBulkDeleteBody(body: unknown): string[] {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException({ error: 'Request body must be an object.' });
  }

  const raw = (body as { ids?: unknown }).ids;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new BadRequestException({ error: 'ids must be a non-empty array.' });
  }
  if (raw.length > ONBOARDING_KNOWLEDGE_BULK_DELETE_MAX_IDS) {
    throw new BadRequestException({
      error: `At most ${ONBOARDING_KNOWLEDGE_BULK_DELETE_MAX_IDS} ids are allowed per request.`,
    });
  }

  const ids = [...new Set(raw.map((x) => String(x ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) {
    throw new BadRequestException({ error: 'ids must contain at least one non-empty string.' });
  }

  return ids;
}
