import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SuperAdminGuard } from './super-admin.guard';

type RequestWithUser = FastifyRequest & { superAdminUser?: { _id: unknown; email: string } };

function parseLoginBody(body: unknown): { email: string; password: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const password = typeof o.password === 'string' ? o.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email) || !password) return null;
  return { email, password };
}

@Controller('api/super-admin')
export class SuperAdminLoginController {
  constructor(private readonly authService: SuperAdminAuthService) {}

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: false }) reply: FastifyReply) {
    const parsed = parseLoginBody(body);
    if (!parsed) {
      throw new HttpException(
        { error: 'Invalid request body' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const user = await this.authService.validateCredentials(parsed.email, parsed.password);
    if (!user) {
      throw new HttpException(
        { error: 'Invalid credentials' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const token = this.authService.signToken(String((user as { _id?: unknown })._id));
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 60 * 24 * 7;
    const cookie =
      `sa_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
      (isProduction ? '; Secure' : '');
    reply.header('Set-Cookie', cookie);
    return reply.send({ success: true });
  }

  @Post('logout')
  async logout(@Res({ passthrough: false }) reply: FastifyReply) {
    reply.header('Set-Cookie', 'sa_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(SuperAdminGuard)
  me(@Req() req: RequestWithUser) {
    const user = req.superAdminUser;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    return { id: String((user as { _id?: unknown })._id), email: (user as { email?: string }).email ?? '' };
  }
}
