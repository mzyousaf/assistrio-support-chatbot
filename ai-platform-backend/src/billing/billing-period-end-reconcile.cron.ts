import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  parseAppModeFromEnv,
  resolveEnableBillingReconcileCronFromEnv,
  resolveBillingReconcileCronExpression,
} from '../config/app-mode.util';
import { BillingPeriodEndReconcileService } from './billing-period-end-reconcile.service';

const CRON_NAME = 'billing_period_end_reconcile';

@Injectable()
export class BillingPeriodEndReconcileCron {
  private inFlight = false;

  constructor(private readonly reconcileService: BillingPeriodEndReconcileService) {}

  private shouldRun(): boolean {
    const mode = parseAppModeFromEnv();
    if (mode === 'api' || mode === 'runtime') return false;
    if (mode !== 'all' && mode !== 'worker') return false;
    return resolveEnableBillingReconcileCronFromEnv();
  }

  /** Production: every 15 minutes. Non-production: every minute (safe; idempotent). */
  @Cron(resolveBillingReconcileCronExpression())
  async runBillingPeriodEndReconcileCron(): Promise<void> {
    if (!this.shouldRun()) return;
    if (this.inFlight) return;

    this.inFlight = true;
    try {
      await this.reconcileService.reconcile(new Date());
    } finally {
      this.inFlight = false;
    }
  }

  /** @internal Test hook for cron name registration. */
  static cronName(): string {
    return CRON_NAME;
  }
}
