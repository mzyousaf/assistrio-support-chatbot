import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import OpenAI from 'openai';
import { SuperAdminGuard } from './super-admin.guard';

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

@Controller('api/super-admin/openai')
@UseGuards(SuperAdminGuard)
export class SuperAdminOpenaiController {
  @Post('test-key')
  async testKey(@Body() body: { apiKey?: string }) {
    const raw = body?.apiKey != null ? String(body.apiKey) : '';
    const apiKey = raw.trim();

    if (!apiKey) {
      throw new HttpException(
        { ok: false, error: 'missing_key' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const client = new OpenAI({ apiKey });
      await client.models.list();
      return { ok: true };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;
      if (status === 401 || /incorrect api key|invalid_api_key|unauthorized/i.test(msg)) {
        throw new HttpException(
          { ok: false, error: 'invalid_key' },
          HttpStatus.BAD_REQUEST,
        );
      }
      console.error('OpenAI test-key failed:', maskKey(apiKey), msg);
      throw new HttpException(
        { ok: false, error: 'invalid_key' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
