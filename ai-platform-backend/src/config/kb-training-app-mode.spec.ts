import { HttpException } from '@nestjs/common';
import { assertHttpJobProcessingAllowed } from '../ingestion/http-job-processing.guard';
import {
  canProcessJobsInThisProcess,
  parseAppModeFromEnv,
  resolveEnableKbWorkerFromEnv,
  shouldRegisterKbInProcessCronsForAppModule,
  shouldRegisterKbInProcessCronsForWorkerApp,
  shouldRejectHttpJobProcessing,
} from './app-mode.util';

describe('KB worker / APP_MODE gating', () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('API mode disables effective KB worker regardless of ENABLE_KB_WORKER', () => {
    process.env.APP_MODE = 'api';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(resolveEnableKbWorkerFromEnv()).toBe(false);
    expect(canProcessJobsInThisProcess()).toBe(false);
  });

  it('all + ENABLE_KB_WORKER=true allows job processing in principle', () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(parseAppModeFromEnv()).toBe('all');
    expect(resolveEnableKbWorkerFromEnv()).toBe(true);
    expect(canProcessJobsInThisProcess()).toBe(true);
    expect(shouldRegisterKbInProcessCronsForAppModule()).toBe(true);
  });

  it('all + ENABLE_KB_WORKER=false disables worker', () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'false';
    expect(resolveEnableKbWorkerFromEnv()).toBe(false);
    expect(shouldRegisterKbInProcessCronsForAppModule()).toBe(false);
  });

  it('worker mode registers crons only when KB worker enabled', () => {
    process.env.APP_MODE = 'worker';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(shouldRegisterKbInProcessCronsForWorkerApp()).toBe(true);
    process.env.ENABLE_KB_WORKER = 'false';
    expect(shouldRegisterKbInProcessCronsForWorkerApp()).toBe(false);
  });

  it('runtime mode does not process KB jobs', () => {
    process.env.APP_MODE = 'runtime';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(canProcessJobsInThisProcess()).toBe(false);
  });

  it('shouldRejectHttpJobProcessing for api/runtime and when KB worker is off in all mode', () => {
    process.env.APP_MODE = 'api';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(shouldRejectHttpJobProcessing()).toBe(true);

    process.env.APP_MODE = 'runtime';
    expect(shouldRejectHttpJobProcessing()).toBe(true);

    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'false';
    expect(shouldRejectHttpJobProcessing()).toBe(true);

    process.env.ENABLE_KB_WORKER = 'true';
    expect(shouldRejectHttpJobProcessing()).toBe(false);
  });

  it('assertHttpJobProcessingAllowed matches HTTP guard expectations for auto-run', () => {
    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'true';
    expect(() => assertHttpJobProcessingAllowed({})).not.toThrow();

    process.env.APP_MODE = 'runtime';
    expect(() => assertHttpJobProcessingAllowed({})).toThrow(HttpException);

    process.env.APP_MODE = 'all';
    process.env.ENABLE_KB_WORKER = 'false';
    expect(() => assertHttpJobProcessingAllowed({})).toThrow(HttpException);
  });
});
