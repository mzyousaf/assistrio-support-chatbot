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
import { AuthGuard, type RequestUser } from './auth.guard';
import { AuthService } from './auth.service';
import type { UserRole } from '../models';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function parseLoginBody(body: unknown): { email: string; password: string } | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const email = typeof o.email === 'string' ? o.email.trim() : '';
  const password = typeof o.password === 'string' ? o.password : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+/.test(email) || !password) return null;
  return { email, password };
}

@Controller('api/user')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
    const u = user as unknown as { _id: unknown; role: string };
    const token = this.authService.signToken(String(u._id), u.role as UserRole);
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = 60 * 60 * 24 * 7;
    const cookie =
      `user_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
      (isProduction ? '; Secure' : '');
    reply.header('Set-Cookie', cookie);
    return reply.send({ success: true });
  }

  @Post('logout')
  async logout(@Res({ passthrough: false }) reply: FastifyReply) {
    reply.header('Set-Cookie', 'user_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return reply.send({ success: true });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    return { id: String(user._id), email: user.email, role: user.role };
  }
}
