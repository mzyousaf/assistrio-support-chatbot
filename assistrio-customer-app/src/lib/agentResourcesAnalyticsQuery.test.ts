import { describe, expect, it } from 'vitest';
import {
  AGENT_RESOURCES_ANALYTICS_DEFAULTS,
  KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS,
  buildAgentResourcesAnalyticsApiParams,
} from './agentResourcesAnalyticsQuery';

describe('buildAgentResourcesAnalyticsApiParams', () => {
  it('defaults to last 7 days preset', () => {
    expect(AGENT_RESOURCES_ANALYTICS_DEFAULTS.preset).toBe('7d');
  });

  it('KB item Source Usage defaults match Agent Resources (7d, preview on)', () => {
    expect(KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.preset).toBe('7d');
    expect(KB_ITEM_PRIMARY_SOURCE_ANALYTICS_DEFAULTS.includePreview).toBe(true);
  });

  it('passes runtime_widget via startedFrom', () => {
    const p = buildAgentResourcesAnalyticsApiParams({
      ...AGENT_RESOURCES_ANALYTICS_DEFAULTS,
      startedFromKeys: ['runtime_widget'],
    });
    expect(p.startedFrom).toBe('runtime_widget');
  });
});
