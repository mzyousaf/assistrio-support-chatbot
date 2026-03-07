import {
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { uploadPublicAvatar } from '../lib/s3';
import { SuperAdminGuard } from './super-admin.guard';

const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

async function parseMultipartFile(
  req: FastifyRequest,
  fieldName: string,
): Promise<{ buffer: Buffer; mimetype: string; originalname: string } | null> {
  const raw = req as FastifyRequest & {
    isMultipart?: () => boolean;
    parts?: () => AsyncIterable<{
      type: string;
      fieldname: string;
      filename?: string;
      mimetype?: string;
      toBuffer?: () => Promise<Buffer>;
    }>;
  };
  if (!raw.isMultipart?.() || !raw.parts) return null;
  for await (const part of raw.parts()) {
    if (part.type === 'file' && part.fieldname === fieldName && part.filename && part.toBuffer) {
      const buffer = await part.toBuffer();
      return {
        buffer,
        mimetype: part.mimetype ?? 'application/octet-stream',
        originalname: part.filename,
      };
    }
  }
  return null;
}

@Controller('api/super-admin/uploads')
@UseGuards(SuperAdminGuard)
export class SuperAdminUploadsController {
  /** Avatar/image upload: uses shared uploadToS3 (public). */
  @Post('image')
  async uploadImage(@Req() req: FastifyRequest) {
    const file = await parseMultipartFile(req, 'file');
    if (!file) {
      throw new HttpException(
        { ok: false, error: 'missing_file' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new HttpException(
        { ok: false, error: 'invalid_type', message: 'Only PNG, JPG, and WEBP are allowed.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (file.buffer.length > MAX_SIZE_BYTES) {
      throw new HttpException(
        { ok: false, error: 'file_too_large', message: 'Image must be under 2MB.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await uploadPublicAvatar({
        body: file.buffer,
        originalName: file.originalname,
        contentType: file.mimetype,
      });
      return { ok: true, url: result.url, key: result.key, bucket: result.bucket };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[uploads/image] S3 upload failed:', message);
      throw new HttpException(
        {
          ok: false,
          error: 'upload_failed',
          message: message.startsWith('S3 upload failed:')
            ? message
            : `S3 upload failed: ${message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
