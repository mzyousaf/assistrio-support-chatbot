import { describe, expect, it } from 'vitest';
import {
  resolvePlanModalFeatureTooltip,
  resolvePlanModalLimitTooltip,
} from './planModalFeatureTooltips';

describe('planModalFeatureTooltips', () => {
  it('shows trial credits note only on free plan AI credits', () => {
    const free = resolvePlanModalLimitTooltip('AI credits', 'free');
    const starter = resolvePlanModalLimitTooltip('AI credits', 'starter');

    expect(free?.bullets.some((b) => b.includes('Trial credits do not renew'))).toBe(true);
    expect(starter?.bullets.some((b) => b.includes('Trial credits do not renew'))).toBe(false);
  });

  it('uses distinct messaging tooltips', () => {
    const voice = resolvePlanModalFeatureTooltip('Voice messages', 'starter');
    const dictation = resolvePlanModalFeatureTooltip('Dictation', 'starter');
    const attachments = resolvePlanModalFeatureTooltip('Attachments', 'starter');

    expect(voice?.bullets.some((b) => b.includes('2 AI credits'))).toBe(true);
    expect(voice?.bullets.some((b) => b.toLowerCase().includes('transcrib'))).toBe(true);
    expect(dictation?.bullets.some((b) => b.includes('0.25'))).toBe(true);
    expect(dictation?.bullets.some((b) => b.toLowerCase().includes('dictation pass'))).toBe(true);
    expect(attachments?.bullets).toHaveLength(1);
    expect(attachments?.bullets[0]?.toLowerCase()).not.toContain('process');
    expect(voice?.bullets).not.toEqual(dictation?.bullets);
  });

  it('includes tooltips for analytics and widget features', () => {
    expect(resolvePlanModalFeatureTooltip('Topic analytics', 'pro')).not.toBeNull();
    expect(resolvePlanModalFeatureTooltip('Sentiment analytics', 'pro')).not.toBeNull();
    expect(resolvePlanModalFeatureTooltip('Auto-train agent', 'starter')).not.toBeNull();
    expect(resolvePlanModalFeatureTooltip('Iframe/embed widget', 'pro')).not.toBeNull();
  });
});
