import {
  parseAndValidatePatchTraining,
  parseAndValidateRetrainAgent,
  parseAndValidateTrainNow,
} from './knowledge-overview.service';

describe('parseAndValidatePatchTraining', () => {
  it('accepts both fields in partial mode', () => {
    const r = parseAndValidatePatchTraining(
      { autoTrainEnabled: false, trainingDelayMinutes: 0 },
      true,
    );
    expect(r).toEqual({ ok: true, value: { autoTrainEnabled: false, trainingDelayMinutes: 0 } });
  });

  it('rejects non-boolean autoTrainEnabled', () => {
    const r = parseAndValidatePatchTraining({ autoTrainEnabled: 'yes' as unknown as boolean }, true);
    expect(r.ok).toBe(false);
  });

  it('rejects trainingDelayMinutes out of range', () => {
    const r = parseAndValidatePatchTraining({ trainingDelayMinutes: 2000 }, true);
    expect(r.ok).toBe(false);
  });

  it('requires all fields in non-partial mode', () => {
    const r = parseAndValidatePatchTraining({ autoTrainEnabled: true }, false);
    expect(r.ok).toBe(false);
  });
});

describe('parseAndValidateRetrainAgent', () => {
  it('parses defaults and optional toggles', () => {
    const r = parseAndValidateRetrainAgent({});
    expect(r).toEqual({ ok: true, value: { includeFailed: true, forceRetrain: false } });
  });

  it('accepts explicit includeFailed / forceRetrain', () => {
    const r = parseAndValidateRetrainAgent({
      includeFailed: false,
      forceRetrain: true,
    });
    expect(r).toEqual({ ok: true, value: { includeFailed: false, forceRetrain: true } });
  });
});

describe('parseAndValidateTrainNow', () => {
  it('parses type=all and optional toggles', () => {
    const r = parseAndValidateTrainNow({
      type: 'all',
      forceRetrain: true,
      includeFailed: false,
    });
    expect(r).toEqual({
      ok: true,
      value: { type: 'all', forceRetrain: true, includeFailed: false },
    });
  });

  it('accepts itemId for single-item train', () => {
    const r = parseAndValidateTrainNow({ type: 'faq', itemId: '507f1f77bcf86cd799439011' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.itemId).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects invalid type', () => {
    const r = parseAndValidateTrainNow({ type: 'invalid' });
    expect(r.ok).toBe(false);
  });
});
