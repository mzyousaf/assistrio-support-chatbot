import { Controller, Get, Header, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';
import { shapePublicBotListItem } from './public-bot-response.util';

@Controller('api/public/landing')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingBotsController {
  constructor(private readonly botsService: BotsService) { }

  @Get('bots')
  @Header('Cache-Control', 'private, max-age=60')
  async list() {
    try {
      const rows = await this.botsService.findPublicShowcaseBySuperAdminCreators();
      return rows
        .map((row) => shapePublicBotListItem(row))
        .filter((row): row is NonNullable<typeof row> => row !== null);
    } catch (error) {
      console.error(error);
      throw new HttpException({ error: 'Failed to fetch bots' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
