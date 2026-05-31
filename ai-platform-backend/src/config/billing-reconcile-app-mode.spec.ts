import {
  resolveBillingReconcileCronExpression,
  resolveEnableBillingReconcileCronFromEnv,
  shouldRegisterBillingReconcileCronsForAppModule,
  shouldRegisterBillingReconcileCronsForWorkerApp,
  shouldRegisterInProcessScheduleForAppModule,
  shouldRegisterInProcessScheduleForWorkerApp,
} from './app-mode.util';

describe('billing reconcile APP_MODE gating', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('API mode disables billing reconcile regardless of ENABLE_BILLING_RECONCILE_CRON', () => {
    process.env.APP_MODE = 'api';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';
    expect(resolveEnableBillingReconcileCronFromEnv()).toBe(false);
    expect(shouldRegisterBillingReconcileCronsForAppModule()).toBe(false);
    expect(shouldRegisterBillingReconcileCronsForWorkerApp()).toBe(false);
  });

  it('runtime mode disables billing reconcile', () => {
    process.env.APP_MODE = 'runtime';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';
    expect(resolveEnableBillingReconcileCronFromEnv()).toBe(false);
  });

  it('all + default enables billing reconcile cron registration', () => {
    process.env.APP_MODE = 'all';
    delete process.env.ENABLE_BILLING_RECONCILE_CRON;
    expect(shouldRegisterBillingReconcileCronsForAppModule()).toBe(true);
    expect(shouldRegisterInProcessScheduleForAppModule()).toBe(true);
  });

  it('all + ENABLE_BILLING_RECONCILE_CRON=false disables reconcile but KB may still register schedule', () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'false';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(shouldRegisterBillingReconcileCronsForAppModule()).toBe(false);
    expect(shouldRegisterInProcessScheduleForAppModule()).toBe(true);
  });

  it('all with KB off still registers schedule when billing reconcile enabled', () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'false';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';
    expect(shouldRegisterInProcessScheduleForAppModule()).toBe(true);
  });

  it('worker mode registers billing reconcile when enabled', () => {
    process.env.APP_MODE = 'worker';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';
    expect(shouldRegisterBillingReconcileCronsForWorkerApp()).toBe(true);
    expect(shouldRegisterInProcessScheduleForWorkerApp()).toBe(true);
  });

  it('worker + ENABLE_BILLING_RECONCILE_CRON=false with KB off skips schedule', () => {
    process.env.APP_MODE = 'worker';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'false';
    process.env.ENABLE_KB_WORKER = 'false';
    expect(shouldRegisterInProcessScheduleForWorkerApp()).toBe(false);
  });

  it('uses 15-minute cron in production and 1-minute otherwise', () => {
    process.env.NODE_ENV = 'production';
    expect(resolveBillingReconcileCronExpression()).toBe('*/15 * * * *');
    process.env.NODE_ENV = 'development';
    expect(resolveBillingReconcileCronExpression()).toBe('* * * * *');
  });
});
