import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AdminBootstrapController } from './admin-bootstrap.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [AdminBootstrapController],
})
export class InternalModule {}
