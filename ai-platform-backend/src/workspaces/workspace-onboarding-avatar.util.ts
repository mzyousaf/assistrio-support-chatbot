import { HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export const ONBOARDING_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const ONBOARDING_AVATAR_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type ParsedOnboardingAvatarUpload = {
  buffer: Buffer;
  originalName: string;
  mime: string;
};

type MultipartRequest = FastifyRequest & {
  isMultipart: () => boolean;
  parts: () => AsyncIterable<{
    type: string;
    fieldname?: string;
    filename?: string;
    mimetype?: string;
    toBuffer: () => Promise<Buffer>;
    value?: unknown;
  }>;
};

export async function parseOnboardingAvatarMultipart(req: FastifyRequest): Promise<ParsedOnboardingAvatarUpload> {
  const r = req as MultipartRequest;
  if (!r.isMultipart()) {
    throw new HttpException(
      { error: 'Expected multipart/form-data with a file field named "file".' },
      HttpStatus.BAD_REQUEST,
    );
  }

  let buffer: Buffer | null = null;
  let originalName = 'avatar';
  let mime = '';

  try {
    for await (const part of r.parts()) {
      if (part.type === 'file') {
        if (part.fieldname !== 'file') {
          throw new HttpException(
            { error: 'Unexpected file field. Use field name "file".' },
            HttpStatus.BAD_REQUEST,
          );
        }
        if (buffer !== null) {
          throw new HttpException({ error: 'Only one file is allowed per request.' }, HttpStatus.BAD_REQUEST);
        }
        buffer = await part.toBuffer();
        originalName = (part.filename || 'avatar').trim() || 'avatar';
        mime =
          part.mimetype && part.mimetype !== 'application/octet-stream'
            ? part.mimetype.toLowerCase()
            : '';
      } else if (part.type === 'field') {
        void String(part.value ?? '');
      }
    }
  } catch (e) {
    if (e instanceof HttpException) throw e;
    const err = e as { statusCode?: number; code?: string };
    if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
      throw new HttpException(
        { error: 'File too large', maxBytes: ONBOARDING_AVATAR_MAX_BYTES },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    throw new HttpException({ error: 'Upload failed' }, HttpStatus.BAD_REQUEST);
  }

  if (!buffer?.length) {
    throw new HttpException(
      { error: 'Missing file. Send multipart field "file".' },
      HttpStatus.BAD_REQUEST,
    );
  }

  if (!mime || !ONBOARDING_AVATAR_ALLOWED_TYPES.has(mime)) {
    throw new HttpException(
      { error: 'Only PNG, JPG, and WebP images are allowed for avatars.' },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  if (buffer.length > ONBOARDING_AVATAR_MAX_BYTES) {
    throw new HttpException({ error: 'Image must be under 2MB.' }, HttpStatus.BAD_REQUEST);
  }

  return { buffer, originalName, mime };
}
