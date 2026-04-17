import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/shared/auth.service';

/**
 * One-time / ops bootstrap — not for browser flows. Requires {@link AppConfig.adminBootstrapToken}.
 */
@Controller('api/internal/admin-bootstrap')
export class AdminBootstrapController {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  @Post('create-superadmin')
  @HttpCode(201)
  async createSuperadmin(
    @Headers('x-admin-bootstrap-token') token: string | undefined,
    @Body() body: { email?: string; password?: string },
  ) {
    const expected = this.config.get<string>('adminBootstrapToken')?.trim() ?? '';
    if (!expected) {
      throw new HttpException(
        { ok: false, error: 'Bootstrap is not configured', errorCode: 'BOOTSTRAP_DISABLED' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!token?.trim() || token.trim() !== expected) {
      throw new HttpException(
        { ok: false, error: 'Unauthorized', errorCode: 'BOOTSTRAP_UNAUTHORIZED' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email.trim() || !password) {
      throw new HttpException(
        { ok: false, error: 'email and password are required', errorCode: 'BAD_REQUEST' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const user = await this.authService.createUser(email.trim(), password, 'superadmin');
      return {
        ok: true,
        userId: String((user as unknown as { _id: unknown })._id),
        email: (user as unknown as { email: string }).email,
        role: 'superadmin' as const,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'User with this email already exists') {
        throw new HttpException(
          { ok: false, error: msg, errorCode: 'EMAIL_ALREADY_EXISTS' },
          HttpStatus.CONFLICT,
        );
      }
      if (msg === 'Invalid email' || msg.includes('Password')) {
        throw new HttpException(
          { ok: false, error: msg, errorCode: 'BAD_REQUEST' },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw e;
    }
  }
}
