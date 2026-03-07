import { Controller, Get, Param } from '@nestjs/common';
import { BotsService } from './bots.service';

@Controller('api/bots')
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
