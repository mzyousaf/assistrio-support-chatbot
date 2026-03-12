import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BotsController } from './bots.controller';
import { PublicBotsController } from './public-bots.controller';
import { BotsService } from './bots.service';
import { Bot, BotSchema } from '../models';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Bot.name, schema: BotSchema }]),
    EmbeddingModule,
  ],
  controllers: [BotsController, PublicBotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
