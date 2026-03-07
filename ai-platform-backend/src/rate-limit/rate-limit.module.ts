import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RateLimit, RateLimitSchema } from '../models';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: RateLimit.name, schema: RateLimitSchema }]),
  ],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
