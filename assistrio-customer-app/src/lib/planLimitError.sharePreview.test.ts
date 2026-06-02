import { describe, expect, it } from 'vitest';
import {
  mapPlanLimitErrorCodeToUpgradeReason,
  PLAN_LIMIT_SHARE_PREVIEW_CODE,
  resolveUpgradePlanReasonSubtitle,
} from '@/lib/planLimitError';
import { resolvePaidPlanFeatureCalloutPreset } from '@/lib/paidPlanFeatureCalloutCopy';

describe('share preview plan limit mapping', () => {
  it('maps plan_limit_share_preview to share_preview reason', () => {
    expect(mapPlanLimitErrorCodeToUpgradeReason(PLAN_LIMIT_SHARE_PREVIEW_CODE)).toBe('share_preview');
  });

  it('includes share_preview upgrade subtitle and callout copy', () => {
    expect(resolveUpgradePlanReasonSubtitle('share_preview')).toContain('paid plans');
    expect(resolvePaidPlanFeatureCalloutPreset('share_preview')).toMatchObject({
      title: 'Share preview links',
      description: 'Share preview links are available on paid plans.',
    });
  });
});
