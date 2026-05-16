import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  CustomerAgentResourcesKbTimePoint,
  CustomerAgentResourcesTopPrimarySourceItem,
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageTimePoint,
} from '@/api/types';
import { AgentResourcesKbSourceDistributionPieChart } from './AgentResourcesKbSourceDistributionPieChart';
import { AgentResourcesKbSourceUsageOverTimeChart } from './AgentResourcesKbSourceUsageOverTimeChart';
import { AgentResourcesTopPrimarySourcesChart } from './AgentResourcesTopPrimarySourcesChart';
import { AgentResourcesUsageDistributionPieChart } from './AgentResourcesUsageDistributionPieChart';
import { AgentResourcesUsageOverTimeChart } from './AgentResourcesUsageOverTimeChart';

describe('Agent resources analytics UI pieces', () => {
  const creditRules: CustomerAgentResourcesUsageCreditRule[] = [
    {
      usageType: 'text_message',
      label: 'Text message',
      credits: 1,
      enabled: true,
      billable: true,
    },
    {
      usageType: 'voice_message',
      label: 'Voice message',
      credits: 2,
      enabled: true,
      billable: true,
    },
    {
      usageType: 'dictation_session',
      label: 'Dictation',
      credits: 0.25,
      enabled: true,
      billable: true,
    },
  ];

  it('renders usage over time as a Recharts composed chart', () => {
    const points: CustomerAgentResourcesUsageTimePoint[] = [
      {
        date: '2026-05-01T00:00:00.000Z',
        totalCreditsUsed: 2,
        textMessages: 1,
        voiceMessages: 0,
        voiceDictationSessions: 0,
        suggestedQuestionMessages: 0,
      },
    ];
    const html = renderToStaticMarkup(
      <AgentResourcesUsageOverTimeChart
        points={points}
        granularity="day"
        creditRules={creditRules}
        hiddenSeriesIds={[]}
      />,
    );
    expect(html).toContain('recharts-responsive-container');
    expect(html).toContain('agent-resources-usage-chart');
  });

  it('renders usage distribution as nested Recharts pies', () => {
    const points: CustomerAgentResourcesUsageTimePoint[] = [
      {
        date: '2026-05-01T00:00:00.000Z',
        totalCreditsUsed: 6,
        textMessages: 2,
        voiceMessages: 1,
        voiceDictationSessions: 0,
        suggestedQuestionMessages: 0,
      },
      {
        date: '2026-05-02T00:00:00.000Z',
        totalCreditsUsed: 4,
        textMessages: 1,
        voiceMessages: 1,
        voiceDictationSessions: 0,
        suggestedQuestionMessages: 0,
      },
    ];
    const html = renderToStaticMarkup(
      <AgentResourcesUsageDistributionPieChart
        points={points}
        granularity="day"
        creditRules={creditRules}
        hiddenSeriesIds={[]}
      />,
    );
    expect(html).toContain('recharts-responsive-container');
    expect(html).toContain('agent-resources-usage-distribution-chart');
  });

  it('renders KB source chart when citations exist', () => {
    const points: CustomerAgentResourcesKbTimePoint[] = [
      {
        date: '2026-05-01T00:00:00.000Z',
        messagesWithSources: 2,
        document: 2,
        faq: 0,
      } as CustomerAgentResourcesKbTimePoint,
    ];
    const html = renderToStaticMarkup(
      <AgentResourcesKbSourceUsageOverTimeChart points={points} granularity="day" />,
    );
    expect(html).toContain('recharts-responsive-container');
    expect(html).toContain('agent-resources-kb-source-chart');
  });

  it('renders KB source distribution as nested Recharts pies', () => {
    const points: CustomerAgentResourcesKbTimePoint[] = [
      {
        date: '2026-05-01T00:00:00.000Z',
        messagesWithSources: 5,
        document: 3,
        faq: 2,
      } as CustomerAgentResourcesKbTimePoint,
      {
        date: '2026-05-02T00:00:00.000Z',
        messagesWithSources: 4,
        document: 1,
        faq: 3,
      } as CustomerAgentResourcesKbTimePoint,
    ];
    const html = renderToStaticMarkup(
      <AgentResourcesKbSourceDistributionPieChart points={points} granularity="day" />,
    );
    expect(html).toContain('recharts-responsive-container');
    expect(html).toContain('agent-resources-kb-source-distribution-chart');
  });

  it('never surfaces raw non-http storage URLs inside the ranking chart DOM', () => {
    const rows: CustomerAgentResourcesTopPrimarySourceItem[] = [
      {
        knowledgeBaseItemId: '507f1f77bcf86cd799439011',
        sourceTitle: 'Secret doc',
        sourceType: 'document',
        sourceUrl: 's3://bucket/key',
        primarySourceUses: 3,
        assistantMessages: 3,
        averageScore: null,
        lastUsedAt: null,
      },
    ];
    const html = renderToStaticMarkup(<AgentResourcesTopPrimarySourcesChart rows={rows} />);
    expect(html.toLowerCase()).not.toContain('s3://');
  });
});
