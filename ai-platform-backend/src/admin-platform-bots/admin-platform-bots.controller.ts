import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import type { RequestUser } from '../auth/shared/request-user.types';

type RequestWithUser = FastifyRequest & { user?: RequestUser };
import {
  AdminPlatformBotsService,
  type CreatePlatformBotBody,
  type PatchPlatformBotBody,
} from './admin-platform-bots.service';

/**
 * CRUD for Assistrio platform-owned bots (`isPlatformBot: true` on the shared `Bot` model).
 */
@Controller('api/admin/platform-bots')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminPlatformBotsController {
  constructor(private readonly adminPlatformBotsService: AdminPlatformBotsService) {}

  @Get()
  list(@Query('type') type?: string, @Query('status') status?: string) {
    return this.adminPlatformBotsService.listPlatformBots({ type, status });
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() body: CreatePlatformBotBody) {
    const userId = req?.user?._id != null ? String(req.user._id) : '';
    return this.adminPlatformBotsService.createPlatformBot(userId, body);
  }

  @Get(':botId')
  get(@Param('botId') botId: string) {
    return this.adminPlatformBotsService.getPlatformBot(botId);
  }

  @Patch(':botId')
  patch(@Param('botId') botId: string, @Body() body: PatchPlatformBotBody) {
    return this.adminPlatformBotsService.patchPlatformBot(botId, body);
  }

  @Delete(':botId')
  delete(@Param('botId') botId: string) {
    return this.adminPlatformBotsService.deletePlatformBot(botId);
  }
}
