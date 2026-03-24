import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { LimitsService } from '../limits/limits.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/user/settings/limits')
@UseGuards(AuthGuard)
export class UserLimitsController {
  constructor(private readonly limitsService: LimitsService) {}

  @Get()
  async get() {
    return this.limitsService.getLimitsConfig();
  }

  @Patch()
  async update(
    @Body() body: { showcaseMessageLimit?: number; ownBotMessageLimit?: number },
  ) {
    const current = await this.limitsService.getLimitsConfig();
    const showcaseMessageLimit =
      typeof body?.showcaseMessageLimit === 'number' && Number.isFinite(body.showcaseMessageLimit)
        ? Math.max(0, Math.floor(body.showcaseMessageLimit))
        : current.showcaseMessageLimit;
    const ownBotMessageLimit =
      typeof body?.ownBotMessageLimit === 'number' && Number.isFinite(body.ownBotMessageLimit)
        ? Math.max(0, Math.floor(body.ownBotMessageLimit))
        : current.ownBotMessageLimit;
    await this.limitsService.updateLimitsConfig({
      showcaseMessageLimit,
      ownBotMessageLimit,
    });
    return { showcaseMessageLimit, ownBotMessageLimit };
  }
}
