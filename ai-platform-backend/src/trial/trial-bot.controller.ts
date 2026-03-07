import { Controller, Get, HttpException, HttpStatus, Param } from '@nestjs/common';
import { BotsService } from '../bots/bots.service';

@Controller('api/trial')
export class TrialBotController {
  constructor(private readonly botsService: BotsService) {}

  @Get('bot/:slug')
  async getBotBySlug(@Param('slug') slug: string) {
    const bot = await this.botsService.findOneBySlugForPage(slug, 'visitor-own');
    if (!bot) throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    return bot;
  }
}
