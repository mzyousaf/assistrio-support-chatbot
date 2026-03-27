import { Body, Controller, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import OpenAI from 'openai';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/user/openai')
@UseGuards(AuthGuard)
export class UserOpenAiController {
  @Post('test-key')
  async testKey(@Body() body: unknown) {
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const apiKey = typeof o.apiKey === 'string' ? o.apiKey.trim() : '';
    if (!apiKey) {
      throw new HttpException({ ok: false, error: 'apiKey is required' }, HttpStatus.BAD_REQUEST);
    }
    try {
      const client = new OpenAI({ apiKey });
      await client.models.list();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Could not validate this API key.' };
    }
  }
}
