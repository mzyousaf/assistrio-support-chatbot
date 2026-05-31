import { TrialReminderCron } from './trial-reminder.cron';

describe('TrialReminderCron', () => {
  const originalAppMode = process.env.APP_MODE;
  const originalEnable = process.env.ENABLE_BILLING_RECONCILE_CRON;

  afterEach(() => {
    process.env.APP_MODE = originalAppMode;
    process.env.ENABLE_BILLING_RECONCILE_CRON = originalEnable;
  });

  it('runs reminders in APP_MODE=all', async () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';

    const runReminders = jest.fn().mockResolvedValue(undefined);
    const cron = new TrialReminderCron({ runReminders } as never);

    await cron.runTrialReminderCron();

    expect(runReminders).toHaveBeenCalled();
  });

  it('runs reminders in APP_MODE=worker', async () => {
    process.env.APP_MODE = 'worker';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';

    const runReminders = jest.fn().mockResolvedValue(undefined);
    const cron = new TrialReminderCron({ runReminders } as never);

    await cron.runTrialReminderCron();

    expect(runReminders).toHaveBeenCalled();
  });

  it('does not run in APP_MODE=runtime', async () => {
    process.env.APP_MODE = 'runtime';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';

    const runReminders = jest.fn().mockResolvedValue(undefined);
    const cron = new TrialReminderCron({ runReminders } as never);

    await cron.runTrialReminderCron();

    expect(runReminders).not.toHaveBeenCalled();
  });

  it('does not run in APP_MODE=api', async () => {
    process.env.APP_MODE = 'api';
    process.env.ENABLE_BILLING_RECONCILE_CRON = 'true';

    const runReminders = jest.fn().mockResolvedValue(undefined);
    const cron = new TrialReminderCron({ runReminders } as never);

    await cron.runTrialReminderCron();

    expect(runReminders).not.toHaveBeenCalled();
  });
});
