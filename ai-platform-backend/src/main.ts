import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import type { FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import {
  enforceProductionAppModeOrExit,
  parseAppModeFromEnv,
  resolveEnableKbWorkerFromEnv,
  shouldBootstrapRuntimeAppModule,
  shouldBootstrapWorkerAppModule,
} from './config/app-mode.util';
import { loadEnvFilesBeforeBootstrap } from './config/load-env-early';
import { RuntimeAppModule } from './runtime/runtime.app.module';
import { WorkerAppModule } from './worker/worker.app.module';
import { MAX_MULTIPART_FILE_BYTES } from './documents/bot-document-upload.constants';
import { shouldLogKbCronFor } from './worker/kb-cron-log.util';
import {
  isBrowserOriginAllowedForCors,
  isReflectablePublicEmbedOrigin,
  isSharedPreviewBrowserOriginAllowed,
} from './cors/cors-origin.util';
import {
  isPublicBrowserEmbedCorsPath,
  normalizeRequestPathForCors,
  pathHasApiPrefix,
} from './cors/public-embed-cors-paths.util';

async function bootstrap() {
  /** Must run before `enforceProductionAppModeOrExit` so `NODE_ENV` / `APP_MODE` from `.env` are visible (same as ConfigModule). */
  loadEnvFilesBeforeBootstrap(__dirname);
  enforceProductionAppModeOrExit();
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  /**
   * **TRUST_PROXY:** When the API is behind nginx, ALB, Cloudflare, etc., set `TRUST_PROXY=1` so `req.ip` and rate
   * limits use the **end-client** from `X-Forwarded-For` / `X-Real-IP` (Fastify semantics). If unset while behind a
   * proxy, `req.ip` is usually the proxy address — **all traffic can share one rate-limit bucket**.
   * **Do not** enable if the app is exposed **directly** to the internet without a proxy (spoofing risk from clients).
   * See `getClientIpForRateLimit`, `enforcePublicAnonymousRateLimit`, `consumeEmbedRuntimeRateLimitToken`.
   */
  const trustProxyEnv = process.env.TRUST_PROXY?.trim();
  const trustProxy =
    trustProxyEnv === '1' || trustProxyEnv === 'true' || trustProxyEnv === 'yes';

  const useWorker = shouldBootstrapWorkerAppModule();
  const useRuntime = shouldBootstrapRuntimeAppModule();
  const mode = parseAppModeFromEnv();
  const enableKb = resolveEnableKbWorkerFromEnv();
  const registerMonolithCrons = mode === 'all' && enableKb;
  const registerWorkerCrons = mode === 'worker' && enableKb;
  const rootModuleName = useWorker ? 'WorkerAppModule' : useRuntime ? 'RuntimeAppModule' : 'AppModule';
  console.log(
    `[bootstrap] APP_MODE=${mode} rootModule=${rootModuleName} enableKbWorker=${enableKb} inProcessKbCrons=${useWorker ? registerWorkerCrons : registerMonolithCrons}`,
  );
  if (shouldLogKbCronFor('app_boot')) {
    console.log(
      JSON.stringify({
        kbCron: true,
        phase: 'bootstrap',
        cron: 'app_boot',
        ts: new Date().toISOString(),
        APP_MODE: mode,
        rootModule: rootModuleName,
        enableKbWorker: enableKb,
        inProcessKbCrons: useWorker ? registerWorkerCrons : registerMonolithCrons,
      }),
    );
  }

  const root = useWorker ? WorkerAppModule : useRuntime ? RuntimeAppModule : AppModule;
  const app = await NestFactory.create<NestFastifyApplication>(root, new FastifyAdapter({ trustProxy }));

  const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const corsAllowedHeaders = ['Content-Type', 'Authorization', 'X-API-Key'];

  await app.getHttpAdapter().getInstance().register(cors as never, {
    delegator: (req: FastifyRequest, cb: (err: Error | null, opts?: Record<string, unknown>) => void) => {
      const path = normalizeRequestPathForCors(req.url);
      const isSharedApiPath = pathHasApiPrefix(path, '/api/shared');
      const isPublicEmbedPath = isPublicBrowserEmbedCorsPath(path);
      cb(null, {
        /** Expose optional RFC9745-style metadata headers when handlers set them. */
        exposedHeaders: ['Deprecation', 'Sunset', 'Link', 'Warning'],
        origin: (origin: string | undefined, cb2: (err: Error | null, allow: boolean | string) => void) => {
          if (!origin) {
            cb2(null, false);
            return;
          }
          if (isSharedApiPath) {
            cb2(null, isSharedPreviewBrowserOriginAllowed(origin, nodeEnv) ? origin : false);
            return;
          }
          if (isPublicEmbedPath) {
            cb2(
              null,
              isReflectablePublicEmbedOrigin(origin, nodeEnv) ? origin : false,
            );
            return;
          }
          if (isBrowserOriginAllowedForCors(origin, nodeEnv)) {
            cb2(null, origin);
            return;
          }
          cb2(null, false);
        },
        methods: corsMethods,
        allowedHeaders: corsAllowedHeaders,
        /** Required for cookie-based flows; `Access-Control-Allow-Origin` must echo a specific origin (never `*`). */
        credentials: true,
      });
    },
  });

  await app.getHttpAdapter().getInstance().register(multipart as never, {
    limits: { fileSize: MAX_MULTIPART_FILE_BYTES },
    throwFileSizeLimit: true,
  });
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
