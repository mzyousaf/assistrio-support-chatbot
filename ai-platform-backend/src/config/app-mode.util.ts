/**
 * `APP_MODE` resolution for module metadata and `ConfigService` (`configFactory` copies the same rules).
 * - **Joi** (`configValidationSchema`) rejects invalid values when Nest `ConfigModule` starts.
 * - **parseAppModeFromEnv** throws on any non-empty invalid value so imports (e.g. `app.module.ts`) never silently treat a typo as `all`.
 * - Unset or blank `APP_MODE` → `all` in both.
 */
export type AppMode = 'all' | 'api' | 'worker' | 'runtime';

/** Invalid non-empty values throw (fail fast; also rejected by `configValidationSchema`). */
function parseAppModeFromEnvOrThrow(): AppMode {
  const v = process.env.APP_MODE;
  if (v == null || String(v).trim() === '') {
    return 'all';
  }
  const raw = String(v).trim().toLowerCase();
  if (raw === 'all' || raw === 'api' || raw === 'worker' || raw === 'runtime') {
    return raw;
  }
  throw new Error(
    `[app-mode] Invalid APP_MODE=${JSON.stringify(v)}. Must be one of: all, api, worker, runtime. (Also validated at startup by Joi.)`,
  );
}

/**
 * `process.env` at import/bootstrap (before/parallel to `ConfigService`).
 * **Strict:** a non-empty invalid `APP_MODE` throws; unset/empty string defaults to `all`.
 * Joi in `config.schema.ts` enforces the same at Nest startup.
 */
export function parseAppModeFromEnv(): AppMode {
  return parseAppModeFromEnvOrThrow();
}

export function isApiMode(): boolean {
  return parseAppModeFromEnv() === 'api';
}

/**
 * Whether this deployment mode is allowed to run background ingestion/summary work at all
 * (cron in `all` or `worker` when `ENABLE_KB_WORKER` is on). Does **not** mean HTTP job routes
 * are mounted (worker has no such routes).
 */
export function canProcessJobsInThisProcess(): boolean {
  const mode = parseAppModeFromEnv();
  if (mode === 'api' || mode === 'runtime') return false;
  return resolveEnableKbWorkerFromEnv();
}

/**
 * Reject `POST` job-runner routes on the API monolith when in `api` mode or when `ENABLE_KB_WORKER` is off.
 * (`APP_MODE=worker` does not register these routes.)
 */
export function shouldRejectHttpJobProcessing(): boolean {
  const mode = parseAppModeFromEnv();
  if (mode === 'api' || mode === 'runtime') return true;
  return !resolveEnableKbWorkerFromEnv();
}

/**
 * Production: warn when `APP_MODE` is unset, and require explicit monolith opt-in for `all`.
 * Skipped when `NODE_ENV` is not `production` (local / test unchanged).
 */
export function enforceProductionAppModeOrExit(): void {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim();
  if (nodeEnv !== 'production') return;

  if (!process.env.APP_MODE?.trim()) {
    console.warn(
      '*** [bootstrap] WARNING: NODE_ENV=production but APP_MODE is not set. It defaults to "all" (monolith). Prefer explicit APP_MODE=api, APP_MODE=worker, APP_MODE=runtime, or APP_MODE=all with ALLOW_APP_MODE_ALL_IN_PRODUCTION=true.',
    );
  }

  const mode = parseAppModeFromEnv();
  if (mode === 'all') {
    const allow = process.env.ALLOW_APP_MODE_ALL_IN_PRODUCTION?.trim().toLowerCase();
    if (allow === 'true' || allow === '1' || allow === 'yes') {
      if (resolveEnableKbWorkerFromEnv()) {
        console.warn(
          '*** [bootstrap] WARNING: Production monolith (APP_MODE=all) with KB worker enabled: each replica runs JobsCronService (duplicate cron ticks, extra DB load). Prefer APP_MODE=api + APP_MODE=runtime + APP_MODE=worker. See docs/kb-worker-deployment.md',
        );
      }
      return;
    }
    console.error(
      '*** [bootstrap] FATAL: NODE_ENV=production with APP_MODE=all requires ALLOW_APP_MODE_ALL_IN_PRODUCTION=true, or use APP_MODE=api / APP_MODE=worker / APP_MODE=runtime for split deployments.',
    );
    process.exit(1);
  }
}

/**
 * When unset: `true` in `all` and `worker`, `false` in `api`.
 * When set to true/false (and 1/0, yes/no), that wins except in `api` mode, where the flag is always false.
 */
export function resolveEnableKbWorkerFromEnv(): boolean {
  const mode = parseAppModeFromEnv();
  if (mode === 'api' || mode === 'runtime') return false;
  const e = process.env.ENABLE_KB_WORKER?.trim().toLowerCase();
  if (e === 'true' || e === '1' || e === 'yes') return true;
  if (e === 'false' || e === '0' || e === 'no') return false;
  return true;
}

/** Nest `AppModule` (monolith HTTP): register Schedule + `JobsCronService` when `all` and KB worker is enabled. */
export function shouldRegisterKbInProcessCronsForAppModule(): boolean {
  if (parseAppModeFromEnv() !== 'all') return false;
  return resolveEnableKbWorkerFromEnv();
}

/** `WorkerAppModule` process: register Schedule + `JobsCronService` when in worker mode and KB is enabled. */
export function shouldRegisterKbInProcessCronsForWorkerApp(): boolean {
  if (parseAppModeFromEnv() !== 'worker') return false;
  return resolveEnableKbWorkerFromEnv();
}

/**
 * When unset: `true` in `all` and `worker`, `false` in `api` and `runtime`.
 * When set to true/false (and 1/0, yes/no), that wins except in `api`/`runtime`, where the flag is always false.
 */
export function resolveEnableBillingReconcileCronFromEnv(): boolean {
  const mode = parseAppModeFromEnv();
  if (mode === 'api' || mode === 'runtime') return false;
  const e = process.env.ENABLE_BILLING_RECONCILE_CRON?.trim().toLowerCase();
  if (e === 'true' || e === '1' || e === 'yes') return true;
  if (e === 'false' || e === '0' || e === 'no') return false;
  return true;
}

/** Nest `AppModule` (monolith): register billing period-end reconcile cron when `all` and flag allows. */
export function shouldRegisterBillingReconcileCronsForAppModule(): boolean {
  if (parseAppModeFromEnv() !== 'all') return false;
  return resolveEnableBillingReconcileCronFromEnv();
}

/** `WorkerAppModule`: register billing period-end reconcile cron when in worker mode and flag allows. */
export function shouldRegisterBillingReconcileCronsForWorkerApp(): boolean {
  if (parseAppModeFromEnv() !== 'worker') return false;
  return resolveEnableBillingReconcileCronFromEnv();
}

/** Production: every 15 minutes. Non-production: every minute (idempotent; safe for local dev). */
export function resolveBillingReconcileCronExpression(): string {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim();
  if (nodeEnv === 'production') return '*/15 * * * *';
  return '* * * * *';
}

/** Register Nest `ScheduleModule.forRoot()` in monolith when KB or billing reconcile crons are enabled. */
export function shouldRegisterInProcessScheduleForAppModule(): boolean {
  return shouldRegisterKbInProcessCronsForAppModule() || shouldRegisterBillingReconcileCronsForAppModule();
}

/** Register Nest `ScheduleModule.forRoot()` in worker when KB or billing reconcile crons are enabled. */
export function shouldRegisterInProcessScheduleForWorkerApp(): boolean {
  return shouldRegisterKbInProcessCronsForWorkerApp() || shouldRegisterBillingReconcileCronsForWorkerApp();
}

/**
 * Whether `main.ts` should bootstrap the dedicated **worker** root module
 * (ingestion + summary crons, no public HTTP for workspace/auth).
 */
export function shouldBootstrapWorkerAppModule(): boolean {
  return parseAppModeFromEnv() === 'worker';
}

/**
 * Whether `main.ts` should bootstrap the lean public embed + chat HTTP module (`/api/widget/*`, `/api/chat/*`, track).
 * No `ScheduleModule` or job crons; no workspace dashboard routes.
 */
export function shouldBootstrapRuntimeAppModule(): boolean {
  return parseAppModeFromEnv() === 'runtime';
}
