import { Controller, Get, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { BotsService } from './bots.service';
import { ChatWidgetApiKeyGuard } from './chat-widget-api-key.guard';

@Controller('api/widget')
@UseGuards(ChatWidgetApiKeyGuard)
export class WidgetTestingBotController {
  constructor(private readonly botsService: BotsService) { }

  /**
   * Widget testing helper (secured).
   * Returns any 1 embeddable bot created by a `superadmin` user.
   *
   * Response intentionally includes safe/public fields.
   */
  @Get('testing/bot')
  async getAnySuperadminBot() {
    const bots = await this.botsService.findPublicShowcaseBySuperAdminCreators();
    if (!bots.length) {
      throw new HttpException(
        { error: 'No embeddable bots found for superadmin creators' },
        HttpStatus.NOT_FOUND,
      );
    }

    const bot = bots[0];
    return {
      status: 'ok' as const,
      botId: bot.id,
      bot,
    };
  }
}

