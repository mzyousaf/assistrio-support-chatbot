import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AdminSessionAuthGuard } from './admin-session.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/admin/openai')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminOpenAiController {
  constructor(private readonly config: ConfigService) {}

  /**
   * Validates the server-configured OPENAI_API_KEY (models list). Does not return the key.
   */
  @Post('test-platform-key')
  async testPlatformKey() {
    const apiKey = String(this.config.get<string>('openaiApiKey') || '').trim();
    if (!apiKey) {
      throw new HttpException(
        { ok: false, error: 'OPENAI_API_KEY is not configured on the server.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return { ok: true as const, message: 'Platform OpenAI API key is valid.' };
    } catch {
      throw new HttpException(
        { ok: false, error: 'Platform OpenAI API key failed validation.' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Validates an OpenAI API key (models list). Used when testing a key before saving to a bot.
   */
  @Post('test-key')
  async testKey(@Body() body: unknown) {
    const o = body != null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const apiKey = typeof o.apiKey === 'string' ? o.apiKey.trim() : '';
    if (!apiKey) {
      throw new HttpException({ ok: false, error: 'apiKey is required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
      return { ok: true as const };
    } catch {
      throw new HttpException({ ok: false, error: 'Invalid API key.' }, HttpStatus.BAD_REQUEST);
    }
  }
}
