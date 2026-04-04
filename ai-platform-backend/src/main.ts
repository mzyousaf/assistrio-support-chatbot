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
  isBrowserOriginAllowedForCors,
  isReflectablePublicEmbedOrigin,
  parseCorsExtraOriginsEnv,
} from './cors/cors-origin.util';
import {
  isPublicBrowserEmbedCorsPath,
  normalizeRequestPathForCors,
} from './cors/public-embed-cors-paths.util';

async function bootstrap() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const corsExtraOrigins = parseCorsExtraOriginsEnv(process.env.CORS_EXTRA_ORIGINS);
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

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy }),
  );

  const corsMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const corsAllowedHeaders = ['Content-Type', 'Authorization', 'X-API-Key'];

  await app.getHttpAdapter().getInstance().register(cors as never, {
    delegator: (req: FastifyRequest, cb: (err: Error | null, opts?: Record<string, unknown>) => void) => {
      const path = normalizeRequestPathForCors(req.url);
      const isPublicEmbedPath = isPublicBrowserEmbedCorsPath(path);
      cb(null, {
        origin: (origin: string | undefined, cb2: (err: Error | null, allow: boolean | string) => void) => {
          if (!origin) {
            cb2(null, false);
            return;
          }
          if (isPublicEmbedPath) {
            cb2(
              null,
              isReflectablePublicEmbedOrigin(origin, nodeEnv) ? origin : false,
            );
            return;
          }
          if (isBrowserOriginAllowedForCors(origin, nodeEnv, corsExtraOrigins)) {
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

  const maxDocUploadBytes = 5 * 1024 * 1024; // 5MB for docs (pdf, doc, txt, md)
  await app.getHttpAdapter().getInstance().register(multipart as never, {
    limits: { fileSize: maxDocUploadBytes },
  });
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
