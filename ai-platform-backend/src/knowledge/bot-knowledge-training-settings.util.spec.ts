import {
  computeAutomaticItemRunAfter,
  getKnowledgeTrainingSettings,
  trainingRunAfterFrom,
} from './bot-knowledge-training-settings.util';
import { resolveSmartTrainingDelayMinutes } from './knowledge-smart-schedule.util';

describe('getKnowledgeTrainingSettings', () => {
  it('defaults to auto-train on, 5 minute delay, smart schedule', () => {
    expect(getKnowledgeTrainingSettings(null)).toEqual({
      autoTrainEnabled: true,
      trainingDelayMinutes: 5,
      scheduleMode: 'smart',
    });
    expect(getKnowledgeTrainingSettings({} as never)).toEqual({
      autoTrainEnabled: true,
      trainingDelayMinutes: 5,
      scheduleMode: 'smart',
    });
  });

  it('reads explicit bot.knowledgeTraining', () => {
    expect(
      getKnowledgeTrainingSettings({
        knowledgeTraining: { autoTrainEnabled: false, trainingDelayMinutes: 3 },
      } as never),
    ).toEqual({ autoTrainEnabled: false, trainingDelayMinutes: 3, scheduleMode: 'smart' });
  });

  it('reads scheduleMode fixed', () => {
    expect(
      getKnowledgeTrainingSettings({
        knowledgeTraining: { scheduleMode: 'fixed' },
      } as never),
    ).toEqual({ autoTrainEnabled: true, trainingDelayMinutes: 5, scheduleMode: 'fixed' });
  });
});

describe('trainingRunAfterFrom', () => {
  it('adds trainingDelayMinutes in milliseconds', () => {
    const t = new Date('2026-04-27T10:00:00.000Z');
    const out = trainingRunAfterFrom(t, 5);
    expect(out.getTime()).toBe(t.getTime() + 5 * 60_000);
  });
});

describe('resolveSmartTrainingDelayMinutes', () => {
  it('uses 30s for faq, note, suggestion', () => {
    expect(resolveSmartTrainingDelayMinutes({ kind: 'faq' })).toBe(0.5);
    expect(resolveSmartTrainingDelayMinutes({ kind: 'note' })).toBe(0.5);
    expect(resolveSmartTrainingDelayMinutes({ kind: 'suggestion' })).toBe(0.5);
  });

  it('uses 1 minute for document', () => {
    expect(resolveSmartTrainingDelayMinutes({ kind: 'document' })).toBe(1);
  });

  it('uses 5 minutes for small tables and 20 for large', () => {
    expect(resolveSmartTrainingDelayMinutes({ kind: 'table', rowCount: 10, approxChars: 1000 })).toBe(
      5,
    );
    expect(resolveSmartTrainingDelayMinutes({ kind: 'table', rowCount: 100, approxChars: 0 })).toBe(20);
    expect(resolveSmartTrainingDelayMinutes({ kind: 'table', rowCount: 1, approxChars: 200_000 })).toBe(
      20,
    );
  });
});

describe('computeAutomaticItemRunAfter', () => {
  const queued = new Date('2026-04-27T10:00:00.000Z');

  it('uses immediate when the item has never been trained', () => {
    const out = computeAutomaticItemRunAfter(queued, 5, false);
    expect(out.getTime()).toBe(queued.getTime());
  });

  it('uses delay when the item has trained before', () => {
    const out = computeAutomaticItemRunAfter(queued, 5, true);
    expect(out.getTime()).toBe(queued.getTime() + 5 * 60_000);
  });

  it('uses smart table delay (20m) when bulk sheet retrain', () => {
    const out = computeAutomaticItemRunAfter(queued, 5, true, {
      kind: 'table',
      rowCount: 100,
      approxChars: 0,
    });
    expect(out.getTime()).toBe(queued.getTime() + 20 * 60_000);
  });

  it('uses smart FAQ delay (30s) after prior train when smartSchedule is passed', () => {
    const out = computeAutomaticItemRunAfter(queued, 5, true, { kind: 'faq' });
    expect(out.getTime()).toBe(queued.getTime() + 30_000);
  });
});
