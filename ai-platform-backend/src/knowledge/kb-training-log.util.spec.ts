import { kbTrainingLog, kbTrainingVerboseLogsEnabled } from './kb-training-log.util';

describe('kb-training-log.util', () => {
  const origKb = process.env.KB_TRAINING_LOGS;
  const origDbg = process.env.DEBUG_KB_TRAINING;

  afterEach(() => {
    process.env.KB_TRAINING_LOGS = origKb;
    process.env.DEBUG_KB_TRAINING = origDbg;
    jest.restoreAllMocks();
  });

  it('kbTrainingVerboseLogsEnabled is false when unset', () => {
    delete process.env.KB_TRAINING_LOGS;
    delete process.env.DEBUG_KB_TRAINING;
    expect(kbTrainingVerboseLogsEnabled()).toBe(false);
  });

  it('kbTrainingVerboseLogsEnabled respects KB_TRAINING_LOGS', () => {
    process.env.KB_TRAINING_LOGS = 'true';
    expect(kbTrainingVerboseLogsEnabled()).toBe(true);
  });

  it('kbTrainingLog is a no-op when verbose logs off', () => {
    delete process.env.KB_TRAINING_LOGS;
    delete process.env.DEBUG_KB_TRAINING;
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    kbTrainingLog('hello', { x: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('kbTrainingLog prints when verbose on', () => {
    process.env.KB_TRAINING_LOGS = '1';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    kbTrainingLog('hello', { x: 1 });
    expect(spy).toHaveBeenCalled();
  });
});
