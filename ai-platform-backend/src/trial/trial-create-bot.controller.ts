import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { TrialService, type TrialFile } from './trial.service';
import { parseCreateTrialBotBody } from './trial-create-bot.dto';

interface MultipartFields {
  botName?: string;
  email?: string;
  description?: string;
  visitorId?: string;
  faqs?: string;
}

async function parseMultipart(req: FastifyRequest): Promise<{
  fields: MultipartFields;
  files: TrialFile[];
}> {
  const fields: MultipartFields = {};
  const files: TrialFile[] = [];
  const rawReq = req as FastifyRequest & { isMultipart?: () => boolean; parts?: () => AsyncIterable<{ type: string; fieldname: string; value?: string; filename?: string; mimetype?: string; toBuffer?: () => Promise<Buffer> }> };
  if (!rawReq.isMultipart?.()) {
    return { fields, files };
  }
  const parts = rawReq.parts?.();
  if (!parts) return { fields, files };

  for await (const part of parts) {
    if (part.type === 'field' && part.value !== undefined && typeof part.value === 'string') {
      (fields as Record<string, string>)[part.fieldname] = part.value;
    } else if (part.type === 'file' && part.filename && part.toBuffer) {
      const buffer = await part.toBuffer();
      files.push({
        originalname: part.filename,
        mimetype: part.mimetype ?? 'application/octet-stream',
        buffer,
        size: buffer.length,
      });
    }
  }
  return { fields, files };
}

@Controller('api/trial')
export class TrialCreateBotController {
  constructor(private readonly trialService: TrialService) {}

  @Post('create-bot')
  async createBot(@Req() req: FastifyRequest, @Body() body: unknown) {
    let fields: { botName: string; email: string; description?: string; visitorId: string; faqs?: string } | null = null;
    let files: TrialFile[] = [];

    const contentType = (req.headers['content-type'] ?? '') as string;
    if (contentType.includes('multipart/form-data')) {
      const parsed = await parseMultipart(req);
      fields = parseCreateTrialBotBody(parsed.fields as unknown);
      files = parsed.files;
    } else {
      fields = parseCreateTrialBotBody(body);
    }

    if (!fields) {
      throw new HttpException(
        { error: 'Invalid request body' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.trialService.createTrialBot(fields, files);
    } catch (error) {
      console.error('Create trial bot failed:', error);
      throw new HttpException(
        { error: 'Internal server error' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
