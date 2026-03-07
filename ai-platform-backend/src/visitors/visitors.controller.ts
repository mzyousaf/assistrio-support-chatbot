import { Controller, Get, HttpException, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { SuperAdminGuard } from '../super-admin/super-admin.guard';
import { VisitorsService } from './visitors.service';

@Controller('api/super-admin/visitors')
@UseGuards(SuperAdminGuard)
export class VisitorsController {
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
