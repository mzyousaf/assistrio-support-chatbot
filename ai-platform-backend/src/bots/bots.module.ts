import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { BotsService } from './bots.service';
import { Bot, BotSchema } from '../models';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Bot.name, schema: BotSchema }]),
  ],
  controllers: [BotsController, PublicBotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
