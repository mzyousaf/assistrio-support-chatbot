import { describe, expect, it } from 'vitest';
import {
  FREE_TRIAL_EXPIRED_CODE,
  mapPlanLimitErrorCodeToUpgradeReason,
  PLAN_LIMIT_AI_CREDITS_CODE,
  resolveUpgradePlanReasonSubtitle,
} from './planLimitError';

describe('planLimitError', () => {
  it('maps plan_limit_ai_credits to credits reason', () => {
    expect(mapPlanLimitErrorCodeToUpgradeReason(PLAN_LIMIT_AI_CREDITS_CODE)).toBe('credits');
  });

  it('maps free_trial_expired to trial_expired reason', () => {
    expect(mapPlanLimitErrorCodeToUpgradeReason(FREE_TRIAL_EXPIRED_CODE)).toBe('trial_expired');
  });

  it('returns credits subtitle copy', () => {
    expect(resolveUpgradePlanReasonSubtitle('credits')).toBe(
      'Your workspace has used all available AI credits.',
    );
  });

  it('returns trial subtitle copy', () => {
    expect(resolveUpgradePlanReasonSubtitle('trial_expired')).toBe('Your free trial has ended.');
  });
});
