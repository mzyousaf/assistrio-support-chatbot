import { Controller, Get, Header, HttpException, HttpStatus, Param } from '@nestjs/common';
import { BotsService } from './bots.service';
import { shapePublicBotDetail, shapePublicBotListItem } from './public-bot-response.util';

@Controller('api/public/bots')
export class PublicBotsController {
  constructor(private readonly botsService: BotsService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async list() {
    try {
      const rows = await this.botsService.findPublicShowcase();
      return rows
        .map((row) => shapePublicBotListItem(row))
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        { error: 'Failed to fetch bots' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=60')
  async getBySlug(@Param('slug') slug: string) {
    const bot = await this.botsService.findOneBySlugForPage(slug, 'showcase');
    const shaped = bot ? shapePublicBotDetail(bot) : null;
    if (!shaped) throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    return shaped;
  }
}
