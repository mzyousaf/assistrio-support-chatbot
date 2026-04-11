import { Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { LandingSiteApiKeyGuard } from '../landing-site-api-key/landing-site-api-key.guard';
import { VisitorsService } from './visitors.service';

/**
 * Multipart upload for trial onboarding assets (marketing → Nest with `X-API-Key` + session header).
 */
@Controller('api/landing/trial')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingTrialUploadController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post('onboarding/upload')
  async upload(@Req() req: FastifyRequest) {
    const rawHeader = req.headers['x-trial-dashboard-session-token'];
    const sessionToken = typeof rawHeader === 'string' ? rawHeader.trim() : '';
    if (!sessionToken) {
      throw new HttpException(
        { error: 'Missing session', errorCode: 'SESSION_INVALID' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const reqAny = req as FastifyRequest & {
      parts?: () => AsyncIterable<{
        type: string;
        fieldname?: string;
        filename?: string;
        mimetype?: string;
        toBuffer: () => Promise<Buffer>;
        value?: string;
      }>;
    };
    if (typeof reqAny.parts !== 'function') {
      throw new HttpException({ error: 'Multipart is not configured.' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let fileBuffer: Buffer | null = null;
    let filename = 'upload.bin';
    let mimetype = 'application/octet-stream';
    let kind: '' | 'avatar' | 'knowledge_document' = '';

    for await (const part of reqAny.parts()) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        filename = part.filename || filename;
        mimetype = part.mimetype || mimetype;
      } else if (part.fieldname === 'kind' && typeof part.value === 'string') {
        const v = part.value.trim();
        if (v === 'avatar' || v === 'knowledge_document') kind = v;
      }
    }

    if (!fileBuffer || !kind) {
      throw new HttpException(
        { error: 'Multipart body must include `kind` (avatar | knowledge_document) and `file`.', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.visitorsService.uploadTrialOnboardingAsset(sessionToken, {
      buffer: fileBuffer,
      originalFilename: filename,
      mimeType: mimetype,
      kind,
    });
  }
}
