import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema } from '../models';
import { AuthModule } from '../auth/auth.module';
import { BotsModule } from '../bots/bots.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AdminPlatformBotsController } from './admin-platform-bots.controller';
import { AdminPlatformBotsService } from './admin-platform-bots.service';

@Module({
  imports: [
    AuthModule,
    BotsModule,
    WorkspacesModule,
    MongooseModule.forFeature([{ name: Bot.name, schema: BotSchema }]),
  ],
  controllers: [AdminPlatformBotsController],
  providers: [AdminPlatformBotsService],
})
export class AdminPlatformBotsModule {}
