import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.getHttpAdapter().getInstance().register(cors as never, {
    origin: (origin: string | undefined, cb: (err: Error | null, allow: boolean | string) => void) => {
      // Reflect the browser origin so embedded widgets on customer sites can send credentialed requests
      // (HttpOnly embed session cookie). Authorization is enforced server-side, not by CORS.
      cb(null, origin || true);
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
