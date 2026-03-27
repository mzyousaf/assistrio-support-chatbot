import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  // localhost with any port (e.g. 3000, 3001)
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    const isAssistrio =
      hostname === 'assistrio.com' || hostname.endsWith('.assistrio.com');
    return (url.protocol === 'http:' || url.protocol === 'https:') && isAssistrio;
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.getHttpAdapter().getInstance().register(cors as never, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean | string) => void) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, isAllowedCorsOrigin(origin) ? origin : false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Needed because widget testing uses header `X-API-Key` and browsers require it in preflight.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
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
