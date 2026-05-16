import { Controller, Get, HttpException, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { VisitorsService } from './visitors.service';

/** Marketing / funnel visitor rows for staff (`/api/admin/visitors/*`). */
@Controller('api/admin/visitors')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminVisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Get()
  list() {
    return this.visitorsService.findAll();
  }

  @Get(':visitorId')
  async getOne(@Param('visitorId') visitorId: string) {
    const result = await this.visitorsService.getOneWithDetails(visitorId);
    if (!result) throw new HttpException({ error: 'Visitor not found' }, HttpStatus.NOT_FOUND);
    return result;
  }
}
