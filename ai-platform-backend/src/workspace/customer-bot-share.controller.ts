import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { Types } from 'mongoose';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { BotsService } from '../bots/bots.service';
import {
  assertAllowedSharePreviewExpiresInHours,
  sharePreviewExpiryDateFromHours,
} from '../bots/share-preview-expiry.util';
import { computeOwnerShareLinkStatus, shareChatTokenRevokedAtSet } from '../bots/share-preview-owner-status.util';
import {
  sharePreviewExpiresAtMs,
  sharePreviewTokenHashLooksSet,
} from '../bots/share-preview-policy.util';
import {
  decryptSharePreviewTokenFromStorage,
  encryptSharePreviewTokenForStorage,
  getSharePreviewTokenEncryptionKey,
} from '../bots/share-preview-token-encryption.util';
import { generateSharePreviewPlainToken, hashSharePreviewToken } from '../bots/share-preview-token.util';
import { WorkspacesService } from '../workspaces/workspaces.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

function shareUrlFromBase(publicBase: string, slug: string): string {
  const b = publicBase.trim().replace(/\/$/, '');
  const path = `/share/${encodeURIComponent(slug)}`;
  return b ? `${b}${path}` : path;
}

@Controller('api/customer/bots')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerBotShareController {
  constructor(
    private readonly botsService: BotsService,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  private async requireWorkspaceBot(req: RequestWithUser, botId: string) {
    if (!Types.ObjectId.isValid(botId)) {
      throw new HttpException({ error: 'Invalid id' }, HttpStatus.BAD_REQUEST);
    }
    const bot = await this.botsService.findOne(botId);
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    const uid = req.user?._id != null ? String(req.user._id) : '';
    const ok = await this.workspacesService.canUserAccessWorkspaceBot(
      uid,
      req.user?.role ?? '',
      bot as Record<string, unknown>,
    );
    if (!ok) {
      throw new HttpException({ error: 'Forbidden' }, HttpStatus.FORBIDDEN);
    }
    return bot as Record<string, unknown>;
  }

  private async requireWorkspaceBotManage(req: RequestWithUser, botId: string) {
    const bot = await this.requireWorkspaceBot(req, botId);
    const uid = req.user?._id != null ? String(req.user._id) : '';
    await this.workspacesService.assertCanManageWorkspaceBot(uid, req.user?.role ?? '', bot);
    return bot;
  }

  private safeShareResponse(
    bot: Record<string, unknown>,
    extra?: { previewToken?: string | null; expiresInHours?: number },
  ) {
    const sc = (bot.shareChat ?? {}) as Record<string, unknown>;
    const status = computeOwnerShareLinkStatus(sc);
    const slug = typeof sc.slug === 'string' ? sc.slug.trim().toLowerCase() : '';
    const publicBase = this.configService.get<string>('customerAppBaseUrl')?.trim().replace(/\/$/, '') ?? '';

    const key = getSharePreviewTokenEncryptionKey();
    let previewToken: string | null = null;
    if (extra?.previewToken != null && String(extra.previewToken).trim() !== '') {
      previewToken = String(extra.previewToken).trim();
    } else if (status === 'active' || status === 'disabled' || status === 'expired') {
      const enc = typeof sc.encryptedPreviewToken === 'string' ? sc.encryptedPreviewToken.trim() : '';
      if (enc) {
        const dec = decryptSharePreviewTokenFromStorage(enc, key);
        previewToken = dec;
      }
    }

    const tr = sc.tokenRevokedAt;
    const tokenRevokedAt =
      tr instanceof Date
        ? tr.toISOString()
        : typeof tr === 'string' && tr.trim()
          ? tr.trim()
          : null;

    const expiresAtIso =
      sc.expiresAt instanceof Date
        ? sc.expiresAt.toISOString()
        : typeof sc.expiresAt === 'string'
          ? sc.expiresAt
          : null;

    const hasHash = sharePreviewTokenHashLooksSet(typeof sc.tokenHash === 'string' ? sc.tokenHash : '');
    const expMs = sharePreviewExpiresAtMs({ expiresAt: sc.expiresAt });
    const secureSharePreviewConfigured =
      (status === 'active' || status === 'disabled' || status === 'expired') && hasHash && expMs != null;

    return {
      enabled: sc.enabled === true,
      slug,
      shareUrl: slug ? shareUrlFromBase(publicBase, slug) : '',
      expiresAt: expiresAtIso,
      requiresPreviewToken: true as const,
      status,
      tokenRevokedAt,
      previewToken,
      secureSharePreviewConfigured,
      ...(extra?.expiresInHours != null ? { expiresInHours: extra.expiresInHours } : {}),
    };
  }

  @Get(':id/share-link')
  async getShareLink(@Req() req: RequestWithUser, @Param('id') id: string) {
    const bot = await this.requireWorkspaceBot(req, id);
    return this.safeShareResponse(bot);
  }

  @Post(':id/share-link')
  async createShareLink(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { expiresInHours?: number },
  ) {
    const hours = assertAllowedSharePreviewExpiresInHours(body?.expiresInHours);
    const bot = await this.requireWorkspaceBotManage(req, id);
    const now = new Date();
    const prev =
      bot.shareChat != null && typeof bot.shareChat === 'object'
        ? ({ ...(bot.shareChat as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    let slug = typeof prev.slug === 'string' ? prev.slug.trim().toLowerCase() : '';
    if (!slug) {
      slug = await this.botsService.generateUniqueShareSlug();
    }

    const previewToken = generateSharePreviewPlainToken();
    const key = getSharePreviewTokenEncryptionKey();
    const sharePatch: Record<string, unknown> = {
      ...prev,
      enabled: true,
      slug,
      tokenHash: hashSharePreviewToken(previewToken),
      encryptedPreviewToken: encryptSharePreviewTokenForStorage(previewToken, key),
      expiresAt: sharePreviewExpiryDateFromHours(hours, now),
      tokenRevokedAt: null,
      allowDraft: true,
      createdAt: prev.createdAt instanceof Date ? prev.createdAt : now,
      updatedAt: now,
    };

    await this.botsService.update(id, {
      shareChat: sharePatch,
    });
    const updated = await this.botsService.findOne(id);
    return this.safeShareResponse((updated ?? bot) as Record<string, unknown>, {
      previewToken,
      expiresInHours: hours,
    });
  }

  @Patch(':id/share-link')
  async patchShareLink(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body()
    body: {
      enabled?: boolean;
      revoke?: boolean;
      rotateSlug?: boolean;
      expiresAt?: string | null;
      allowDraft?: boolean;
      regenerateSharePreviewToken?: boolean;
      expiresInHours?: number;
    },
  ) {
    const bot = await this.requireWorkspaceBotManage(req, id);
    const now = new Date();
    const sc =
      bot.shareChat != null && typeof bot.shareChat === 'object'
        ? ({ ...(bot.shareChat as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    if (body.revoke === true) {
      const nextShare: Record<string, unknown> = {
        ...sc,
        enabled: false,
        tokenHash: null,
        encryptedPreviewToken: null,
        expiresAt: null,
        tokenRevokedAt: now,
        updatedAt: now,
      };
      await this.botsService.update(id, { shareChat: nextShare });
      const updated = await this.botsService.findOne(id);
      return this.safeShareResponse((updated ?? bot) as Record<string, unknown>, { previewToken: null });
    }

    const isRegenerate = body.regenerateSharePreviewToken === true;
    const isRotate = body.rotateSlug === true;

    if (isRegenerate || isRotate) {
      let slug = typeof sc.slug === 'string' ? sc.slug.trim().toLowerCase() : '';
      if (isRotate) {
        slug = await this.botsService.generateUniqueShareSlug();
      } else if (!slug) {
        slug = await this.botsService.generateUniqueShareSlug();
      }

      const hours = assertAllowedSharePreviewExpiresInHours(body.expiresInHours);
      const previewToken = generateSharePreviewPlainToken();
      const key = getSharePreviewTokenEncryptionKey();
      const nextShare: Record<string, unknown> = {
        ...sc,
        enabled: true,
        slug,
        tokenHash: hashSharePreviewToken(previewToken),
        encryptedPreviewToken: encryptSharePreviewTokenForStorage(previewToken, key),
        expiresAt: sharePreviewExpiryDateFromHours(hours, now),
        tokenRevokedAt: null,
        allowDraft: true,
        createdAt: sc.createdAt instanceof Date ? sc.createdAt : now,
        updatedAt: now,
      };

      await this.botsService.update(id, { shareChat: nextShare });
      const updated = await this.botsService.findOne(id);
      return this.safeShareResponse((updated ?? bot) as Record<string, unknown>, {
        previewToken,
        expiresInHours: hours,
      });
    }

    if (body.enabled === true) {
      if (shareChatTokenRevokedAtSet(sc)) {
        throw new HttpException(
          {
            error: 'This preview link was revoked. Create a new secure preview link.',
            errorCode: 'SHARE_PREVIEW_REVOKED_REGENERATE_REQUIRED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const hash = typeof sc.tokenHash === 'string' ? sc.tokenHash.trim() : '';
      if (!sharePreviewTokenHashLooksSet(hash)) {
        throw new HttpException(
          {
            error: 'Share preview has no valid token. Regenerate the link first.',
            errorCode: 'SHARE_PREVIEW_REGENERATE_REQUIRED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      const expMs = sharePreviewExpiresAtMs({ expiresAt: sc.expiresAt });
      if (expMs == null || expMs <= Date.now()) {
        throw new HttpException(
          {
            error: 'This preview link has expired. Regenerate it to create a new secure link.',
            errorCode: 'SHARE_PREVIEW_EXPIRED_REGENERATE_REQUIRED',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      let slug = typeof sc.slug === 'string' ? sc.slug.trim().toLowerCase() : '';
      if (!slug) {
        slug = await this.botsService.generateUniqueShareSlug();
      }
      const nextShare: Record<string, unknown> = {
        ...sc,
        enabled: true,
        slug,
        allowDraft: true,
        updatedAt: now,
      };
      await this.botsService.update(id, { shareChat: nextShare });
      const updated = await this.botsService.findOne(id);
      return this.safeShareResponse((updated ?? bot) as Record<string, unknown>);
    }

    if (body.enabled === false) {
      const nextShare: Record<string, unknown> = {
        ...sc,
        enabled: false,
        updatedAt: now,
      };
      await this.botsService.update(id, { shareChat: nextShare });
      const updated = await this.botsService.findOne(id);
      return this.safeShareResponse((updated ?? bot) as Record<string, unknown>);
    }

    throw new HttpException(
      {
        error: 'Invalid share link update. Use enabled, revoke, regenerateSharePreviewToken, or rotateSlug.',
        errorCode: 'INVALID_SHARE_PATCH',
      },
      HttpStatus.BAD_REQUEST,
    );
  }

  @Delete(':id/share-link')
  async deleteShareLink(@Req() req: RequestWithUser, @Param('id') id: string) {
    const bot = await this.requireWorkspaceBotManage(req, id);
    const sc =
      bot.shareChat != null && typeof bot.shareChat === 'object'
        ? ({ ...(bot.shareChat as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const now = new Date();
    await this.botsService.update(id, {
      shareChat: {
        ...sc,
        enabled: false,
        updatedAt: now,
      },
    });
    const updated = await this.botsService.findOne(id);
    return this.safeShareResponse((updated ?? bot) as Record<string, unknown>);
  }
}
