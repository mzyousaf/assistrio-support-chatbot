import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../models';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuthService } from '../auth/shared/auth.service';

/**
 * `AuthService` (preview token verification) + platform `User` + `JwtModule` (embed session cookies),
 * without mounting admin/customer auth HTTP controllers.
 */
@Module({
  imports: [
    WorkspacesModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [AuthService],
  exports: [AuthService, JwtModule, MongooseModule],
})
export class RuntimeAuthCoreModule {}
