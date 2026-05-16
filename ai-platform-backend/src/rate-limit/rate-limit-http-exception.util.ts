import { HttpException, HttpStatus } from '@nestjs/common';
import { PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS } from './public-anonymous-rate-limit.constants';
import { RATE_LIMIT_DEPLOYMENT_HINTS } from './rate-limit-deployment-hints';

function throwRateLimitedPayload(params: {
  retryAfterSeconds: number;
  deploymentHint: string;
}): never {
  throw new HttpException(
    {
      error: 'Too many requests',
      status: 'error',
      errorCode: 'RATE_LIMITED',
      retryAfterSeconds: params.retryAfterSeconds,
      deploymentHint: params.deploymentHint,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

/** Mongo-backed anonymous public routes (trial, quota summary, register-website, public GETs). */
export function throwPublicAnonymousRateLimited(): never {
  const retryAfterSeconds = Math.ceil(PUBLIC_ANONYMOUS_RATE_LIMIT_WINDOW_MS / 1000);
  throwRateLimitedPayload({
    retryAfterSeconds,
    deploymentHint: `${RATE_LIMIT_DEPLOYMENT_HINTS.publicAnonymous} ${RATE_LIMIT_DEPLOYMENT_HINTS.notCors}`,
  });
}

/** In-process embed IP limiter (widget init IP check, chat domain gate IP check). */
export function throwEmbedRuntimeIpRateLimited(windowMs: number): never {
  const retryAfterSeconds = Math.max(1, Math.ceil(windowMs / 1000));
  throwRateLimitedPayload({
    retryAfterSeconds,
    deploymentHint: `${RATE_LIMIT_DEPLOYMENT_HINTS.embedRuntime} ${RATE_LIMIT_DEPLOYMENT_HINTS.notCors}`,
  });
}
