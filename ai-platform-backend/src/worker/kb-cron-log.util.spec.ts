import {
  KB_CRON_LOG_ENV_BY_CRON,
  logCronStart,
  shouldLogKbCron,
  shouldLogKbCronFor,
} from './kb-cron-log.util';

const ALL_CRON_NAMES = Object.keys(KB_CRON_LOG_ENV_BY_CRON);
const MANAGED_ENV_KEYS = ['KB_CRON_LOGS', ...new Set(Object.values(KB_CRON_LOG_ENV_BY_CRON))];

describe('kb-cron-log.util', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
    for (const k of MANAGED_ENV_KEYS) {
      savedEnv[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of MANAGED_ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
    jest.restoreAllMocks();
  });

  it('shouldLogKbCron is enabled only when KB_CRON_LOGS is exactly true', () => {
    process.env.KB_CRON_LOGS = 'true';
    expect(shouldLogKbCron()).toBe(true);
    process.env.KB_CRON_LOGS = '1';
    expect(shouldLogKbCron()).toBe(false);
    process.env.KB_CRON_LOGS = 'false';
    expect(shouldLogKbCron()).toBe(false);
    delete process.env.KB_CRON_LOGS;
    expect(shouldLogKbCron()).toBe(false);
  });

  it('global true with per-cron unset logs all registered crons', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'true';
    for (const name of ALL_CRON_NAMES) {
      expect(shouldLogKbCronFor(name)).toBe(true);
    }
  });

  it('global false with per-cron unset logs none', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'false';
    for (const name of ALL_CRON_NAMES) {
      expect(shouldLogKbCronFor(name)).toBe(false);
    }
  });

  it('per-cron true overrides global false', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS' && k !== 'KB_CRON_LOG_CONTENT_EXTRACTION') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'false';
    process.env.KB_CRON_LOG_CONTENT_EXTRACTION = 'true';
    expect(shouldLogKbCronFor('content_extraction')).toBe(true);
    expect(shouldLogKbCronFor('summary_jobs')).toBe(false);
    expect(shouldLogKbCronFor('app_boot')).toBe(false);
  });

  it('per-cron false overrides global true', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS' && k !== 'KB_CRON_LOG_SUMMARY_JOBS') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'true';
    process.env.KB_CRON_LOG_SUMMARY_JOBS = 'false';
    expect(shouldLogKbCronFor('summary_jobs')).toBe(false);
    expect(shouldLogKbCronFor('content_extraction')).toBe(true);
  });

  it('unknown cron name falls back to global only', () => {
    process.env.KB_CRON_LOGS = 'true';
    expect(shouldLogKbCronFor('unit_unknown_cron')).toBe(true);
    process.env.KB_CRON_LOGS = 'false';
    expect(shouldLogKbCronFor('unit_unknown_cron')).toBe(false);
  });

  it('non-true non-false per-cron values fall back to global', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS' && k !== 'KB_CRON_LOG_CONTENT_EXTRACTION') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'true';
    process.env.KB_CRON_LOG_CONTENT_EXTRACTION = '1';
    expect(shouldLogKbCronFor('content_extraction')).toBe(true);

    process.env.KB_CRON_LOGS = 'false';
    expect(shouldLogKbCronFor('content_extraction')).toBe(false);
    process.env.KB_CRON_LOG_CONTENT_EXTRACTION = '1';
    expect(shouldLogKbCronFor('content_extraction')).toBe(false);
  });

  it('logCronStart is a no-op when effective logging is off', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'false';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    logCronStart('content_extraction', { n: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('logCronStart writes when per-cron true despite global false', () => {
    for (const k of MANAGED_ENV_KEYS) {
      if (k !== 'KB_CRON_LOGS' && k !== 'KB_CRON_LOG_CONTENT_EXTRACTION') delete process.env[k];
    }
    process.env.KB_CRON_LOGS = 'false';
    process.env.KB_CRON_LOG_CONTENT_EXTRACTION = 'true';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    logCronStart('content_extraction', { step: 'alpha' });
    expect(spy).toHaveBeenCalledTimes(1);
    const obj = JSON.parse(String(spy.mock.calls[0][0]));
    expect(obj.kbCron).toBe(true);
    expect(obj.phase).toBe('start');
    expect(obj.cron).toBe('content_extraction');
    expect(obj.step).toBe('alpha');
  });
});
