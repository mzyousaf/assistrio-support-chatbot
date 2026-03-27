import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { configFactory } from './config.factory';
import * as path from 'path';

// Resolve .env from backend package root (works when run from monorepo root or from backend dir)
const backendRoot = path.resolve(__dirname, '..', '..');
const envPaths = [
  path.join(backendRoot, '.env'),
  path.join(backendRoot, '.env.local'),
];

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envPaths,
      load: [configFactory],
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: true },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
