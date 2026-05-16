import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BotsService } from './bots.service';

/**
 * **Not** an anonymous or landing route — lists raw bot records (minus `secretKey`).
 * The public marketing gallery is `GET /api/public/bots` (showcase-only, shaped response).
 */
@Controller('api/bots')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  list() {
    return this.botsService.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.botsService.findOne(id);
  }
}
