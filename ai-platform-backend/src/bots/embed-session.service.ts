import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  buildEmbedSessionSetCookieHeader,
  embedSessionCookieName,
  parseCookieHeader,
} from './embed-session-cookie.util';

const EMBED_JWT_TYP = 'embed_rt' as const;

function safeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

@Injectable()
export class EmbedSessionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issueToken(botId: string, chatVisitorId: string): string {
    const cid = String(chatVisitorId ?? '').trim();
    if (!cid) {
      throw new Error('embed session token requires chatVisitorId');
    }
    return this.jwtService.sign(
      { sub: botId, typ: EMBED_JWT_TYP, cid },
      { expiresIn: '15m' },
    );
  }

  verifyToken(token: string): { botId: string; chatVisitorId: string } | null {
    try {
      const p = this.jwtService.verify<{ typ?: string; sub?: string; cid?: string }>(token);
      if (p?.typ !== EMBED_JWT_TYP || typeof p.sub !== 'string' || !p.sub.trim()) {
        return null;
      }
      const chatVisitorId = typeof p.cid === 'string' ? p.cid.trim() : '';
      if (!chatVisitorId) {
        return null;
      }
      return { botId: p.sub.trim(), chatVisitorId };
    } catch {
      return null;
    }
  }

  getTokenFromRequest(req: FastifyRequest, botId: string): string | undefined {
    const raw = req.headers.cookie;
    const name = embedSessionCookieName(botId);
    const v = parseCookieHeader(raw, name);
    return v?.trim() || undefined;
  }

  /**
   * Validates HttpOnly embed session cookie: must match bot and **chatVisitorId** bound at init.
   */
  verifyRequestForBot(req: FastifyRequest, botId: string, chatVisitorId: string): boolean {
    const token = this.getTokenFromRequest(req, botId);
    if (!token) return false;
    const parsed = this.verifyToken(token);
    if (parsed === null || parsed.botId !== botId) return false;
    return safeEqualString(parsed.chatVisitorId, chatVisitorId);
  }

  setSessionCookie(res: FastifyReply, botId: string, token: string): void {
    const nodeEnv = this.configService.get<string>('nodeEnv') ?? 'development';
    const secure = nodeEnv === 'production';
    const sameSiteNone = secure;
    const name = embedSessionCookieName(botId);
    const header = buildEmbedSessionSetCookieHeader(name, token, { secure, sameSiteNone });
    res.header('Set-Cookie', header);
  }

  refreshSessionCookie(res: FastifyReply, botId: string, chatVisitorId: string): void {
    const token = this.issueToken(botId, chatVisitorId);
    this.setSessionCookie(res, botId, token);
  }
}
