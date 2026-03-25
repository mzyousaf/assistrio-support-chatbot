import { Controller, Get, Header, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';

@Controller('api/public/landing')
@UseGuards(LandingSiteApiKeyGuard)
export class LandingBotsController {
  constructor(private readonly botsService: BotsService) { }

  @Get('bots')
  @Header('Cache-Control', 'private, max-age=60')
  async list() {
    try {
      return await this.botsService.findPublicShowcaseBySuperAdminCreators();
    } catch (error) {
      console.error(error);
      throw new HttpException({ error: 'Failed to fetch bots' }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
