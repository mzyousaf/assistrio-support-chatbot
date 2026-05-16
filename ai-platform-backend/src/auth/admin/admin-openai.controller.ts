import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import OpenAI from 'openai';
import { AdminSessionAuthGuard } from './admin-session.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/admin/openai')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminOpenAiController {
  /**
   * Validates an OpenAI API key (models list). Used by the admin bot form only.
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
