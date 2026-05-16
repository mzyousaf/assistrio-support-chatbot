import { describe, expect, it } from 'vitest';
import {
  AGENT_RESOURCES_ANALYTICS_DEFAULTS,
  buildAgentResourcesAnalyticsApiParams,
} from './agentResourcesAnalyticsQuery';

describe('buildAgentResourcesAnalyticsApiParams', () => {
  it('defaults to last 7 days preset', () => {
    expect(AGENT_RESOURCES_ANALYTICS_DEFAULTS.preset).toBe('7d');
  });

  it('passes runtime_widget via startedFrom', () => {
    const p = buildAgentResourcesAnalyticsApiParams({
      ...AGENT_RESOURCES_ANALYTICS_DEFAULTS,
      startedFrom: 'runtime_widget',
    });
    expect(p.startedFrom).toBe('runtime_widget');
  });
});
