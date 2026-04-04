import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { BotsService } from './bots.service';

/**
 * **Not** an anonymous or landing route — lists raw bot records (minus `secretKey`).
 * The public marketing gallery is `GET /api/public/bots` (showcase-only, shaped response).
 */
@Controller('api/bots')
@UseGuards(AuthGuard, SuperAdminGuard)
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
