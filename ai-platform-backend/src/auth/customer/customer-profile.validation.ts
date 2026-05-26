import { BadRequestException } from '@nestjs/common';

export type CustomerProfileLinksInput = {
  linkedinUrl?: string | null;
  calendlyUrl?: string | null;
  websiteUrl?: string | null;
  otherUrl?: string | null;
};

export type ParsedPatchCustomerProfileBody = {
  displayNameOverride?: string;
  pictureOverride?: string | null;
  profileLinks?: CustomerProfileLinksInput;
};

const MAX_NAME_LENGTH = 120;
const MAX_URL_LENGTH = 2048;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptionalHttpUrl(value: unknown, fieldLabel: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new BadRequestException({ error: `${fieldLabel} must be a string or null.` });
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new BadRequestException({ error: `${fieldLabel} is too long.` });
  }
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new BadRequestException({ error: `${fieldLabel} must use http or https.` });
    }
    return u.toString();
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException({ error: `${fieldLabel} is not a valid URL.` });
  }
}

function parseName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException({ error: 'Name must be a string.' });
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    throw new BadRequestException({ error: 'Name cannot be empty.' });
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new BadRequestException({ error: 'Name is too long.' });
  }
  return trimmed;
}

function parseProfileLinks(value: unknown): CustomerProfileLinksInput | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    throw new BadRequestException({ error: 'profileLinks must be an object.' });
  }
  return {
    linkedinUrl: parseOptionalHttpUrl(value.linkedinUrl, 'LinkedIn URL'),
    calendlyUrl: parseOptionalHttpUrl(value.calendlyUrl, 'Calendly URL'),
    websiteUrl: parseOptionalHttpUrl(value.websiteUrl, 'Website URL'),
    otherUrl: parseOptionalHttpUrl(value.otherUrl, 'Other link URL'),
  };
}

export function parsePatchCustomerProfileBody(body: unknown): ParsedPatchCustomerProfileBody {
  if (!isPlainObject(body)) {
    throw new BadRequestException({ error: 'Request body must be a JSON object.' });
  }

  if (body.email !== undefined) {
    throw new BadRequestException({ error: 'Email cannot be changed.' });
  }

  const hasName = body.name !== undefined;
  const hasAvatar = body.avatarUrl !== undefined;
  const hasLinks = body.profileLinks !== undefined;
  if (!hasName && !hasAvatar && !hasLinks) {
    throw new BadRequestException({ error: 'At least one profile field is required.' });
  }

  const parsed: ParsedPatchCustomerProfileBody = {};
  if (hasName) {
    parsed.displayNameOverride = parseName(body.name);
  }
  if (hasAvatar) {
    parsed.pictureOverride = parseOptionalHttpUrl(body.avatarUrl, 'Avatar URL') ?? null;
  }
  if (hasLinks) {
    parsed.profileLinks = parseProfileLinks(body.profileLinks);
  }
  return parsed;
}
