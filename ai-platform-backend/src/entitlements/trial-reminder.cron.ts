import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  parseAppModeFromEnv,
  resolveEnableBillingReconcileCronFromEnv,
} from '../config/app-mode.util';
import { TrialReminderService } from './trial-reminder.service';

const CRON_NAME = 'trial_reminder';

/** Production: hourly. Non-production: every minute (idempotent). */
export function resolveTrialReminderCronExpression(): string {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').trim();
  if (nodeEnv === 'production') return '0 * * * *';
  return '* * * * *';
}

@Injectable()
export class TrialReminderCron {
  private inFlight = false;

  constructor(private readonly trialReminderService: TrialReminderService) {}

  private shouldRun(): boolean {
    const mode = parseAppModeFromEnv();
    if (mode === 'api' || mode === 'runtime') return false;
    if (mode !== 'all' && mode !== 'worker') return false;
    return resolveEnableBillingReconcileCronFromEnv();
  }

  @Cron(resolveTrialReminderCronExpression())
  async runTrialReminderCron(): Promise<void> {
    if (!this.shouldRun()) return;
    if (this.inFlight) return;

    this.inFlight = true;
    try {
      await this.trialReminderService.runReminders(new Date());
    } finally {
      this.inFlight = false;
    }
  }

  /** @internal Test hook for cron name registration. */
  static cronName(): string {
    return CRON_NAME;
  }
}
