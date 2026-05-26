import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, User, UserSchema } from '../models';
import { AdminOpenAiController } from './admin/admin-openai.controller';
import { AdminPortalController } from './admin/admin-portal.controller';
import { AdminSessionAuthGuard } from './admin/admin-session.guard';
import { SuperAdminGuard } from './admin/super-admin.guard';
import { CustomerGoogleOAuthController } from './customer/customer-google-oauth.controller';
import { CustomerGoogleOAuthService } from './customer/customer-google-oauth.service';
import { CustomerProfileService } from './customer/customer-profile.service';
import { CustomerPortalController } from './customer/customer-portal.controller';
import { CustomerSessionAuthGuard } from './customer/customer-session.guard';
import { AuthService } from './shared/auth.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    WorkspacesModule,
    EntitlementsModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Bot.name, schema: BotSchema },
    ]),
  ],
  controllers: [
    AdminPortalController,
    AdminOpenAiController,
    CustomerPortalController,
    CustomerGoogleOAuthController,
  ],
  providers: [
    AuthService,
    CustomerGoogleOAuthService,
    CustomerProfileService,
    AdminSessionAuthGuard,
    CustomerSessionAuthGuard,
    SuperAdminGuard,
  ],
  exports: [
    AuthService,
    CustomerGoogleOAuthService,
    AdminSessionAuthGuard,
    CustomerSessionAuthGuard,
    SuperAdminGuard,
    JwtModule,
  ],
})
export class AuthModule {}
