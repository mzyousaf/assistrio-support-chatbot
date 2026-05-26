import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

export const CUSTOMER_AVATAR_MAX_MB = 5;
export const CUSTOMER_AVATAR_MAX_BYTES = CUSTOMER_AVATAR_MAX_MB * 1024 * 1024;
export const CUSTOMER_AVATAR_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type ParsedCustomerAvatarUpload = {
  buffer: Buffer;
  originalName: string;
  mime: string;
};

export async function parseCustomerAvatarMultipartUpload(
  req: FastifyRequest,
): Promise<ParsedCustomerAvatarUpload> {
  if (!req.isMultipart()) {
    throw new HttpException(
      { error: 'Expected multipart/form-data with a file field named "file".' },
      HttpStatus.BAD_REQUEST,
    );
  }

  let buffer: Buffer | null = null;
  let originalName = 'avatar';
  let mime = '';

  try {
    for await (const part of req.parts()) {
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
        void String((part as { value?: unknown }).value ?? '');
      }
    }
  } catch (e) {
    if (e instanceof HttpException) throw e;
    const err = e as { statusCode?: number; code?: string };
    if (err.statusCode === 413 || String(err.code ?? '').includes('FILE_TOO_LARGE')) {
      throw new HttpException(
        { error: 'File too large', maxBytes: CUSTOMER_AVATAR_MAX_BYTES },
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

  if (!mime || !CUSTOMER_AVATAR_ALLOWED_TYPES.has(mime)) {
    throw new BadRequestException({ error: 'Only PNG, JPG, and WebP images are allowed for avatars.' });
  }

  if (buffer.length > CUSTOMER_AVATAR_MAX_BYTES) {
    throw new BadRequestException({ error: `Image must be under ${CUSTOMER_AVATAR_MAX_MB}MB.` });
  }

  return { buffer, originalName, mime };
}
