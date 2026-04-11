import { Module } from '@nestjs/common';
import { LandingSiteApiKeyGuard } from './landing-site-api-key.guard';

@Module({
  providers: [LandingSiteApiKeyGuard],
  exports: [LandingSiteApiKeyGuard],
})
export class LandingSiteApiKeyModule {}
