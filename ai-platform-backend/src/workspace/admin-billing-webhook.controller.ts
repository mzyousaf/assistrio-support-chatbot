import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import { BillingAdminWebhookReplayService } from '../billing/billing-admin-webhook-replay.service';

@Controller('api/admin/billing')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminBillingWebhookController {
  constructor(private readonly webhookReplayService: BillingAdminWebhookReplayService) {}

  @Post('webhook-events/:eventId/replay')
  replayWebhookEvent(@Param('eventId') eventId: string) {
    return this.webhookReplayService.replayEvent(eventId);
  }
}
