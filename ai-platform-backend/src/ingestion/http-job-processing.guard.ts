import { HttpException, HttpStatus } from '@nestjs/common';
import { parseAppModeFromEnv, resolveEnableKbWorkerFromEnv, type AppMode } from '../config/app-mode.util';

export const HTTP_JOB_PROCESSING_DISABLED_IN_API =
  'Job processing is disabled in APP_MODE=api or APP_MODE=runtime. Run a worker process with APP_MODE=worker.' as const;

export const HTTP_JOB_PROCESSING_DISABLED_KB =
  'Job processing is disabled (ENABLE_KB_WORKER is false). Run a worker process with APP_MODE=worker, or use APP_MODE=all for a local/development monolith with in-process jobs.' as const;

/**
 * Manual HTTP job endpoints (`/api/jobs/*`, `POST /api/admin/jobs/run`) may only run when not in
 * `api` mode and when `enableKbWorker` is true. Workers use cron, not these routes.
 */
export function assertHttpJobProcessingAllowed(options: { appMode?: AppMode; enableKbWorker?: boolean }): void {
  const appMode = options.appMode ?? parseAppModeFromEnv();
  const enableKbWorker = options.enableKbWorker ?? resolveEnableKbWorkerFromEnv();
  if (appMode === 'api' || appMode === 'runtime') {
    throw new HttpException(
      { message: HTTP_JOB_PROCESSING_DISABLED_IN_API },
      HttpStatus.CONFLICT,
    );
  }
  if (!enableKbWorker) {
    throw new HttpException(
      { message: HTTP_JOB_PROCESSING_DISABLED_KB },
      HttpStatus.CONFLICT,
    );
  }
}
