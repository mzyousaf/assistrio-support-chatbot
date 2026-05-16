import { describe, expect, it } from 'vitest';
import type {
  CustomerAgentResourcesUsageCreditRule,
  CustomerAgentResourcesUsageSummary,
} from '@/api/types';
import { buildAgentResourcesUsageVolumeRows } from './agentResourcesUsageVolumeRows';

const creditRules: CustomerAgentResourcesUsageCreditRule[] = [
  {
    usageType: 'text_message',
    label: 'Text message',
    credits: 1,
    enabled: true,
    billable: true,
    includeInTotalCredits: true,
  },
  {
    usageType: 'voice_message',
    label: 'Voice message',
    credits: 2,
    enabled: true,
    billable: true,
    includeInTotalCredits: true,
  },
  {
    usageType: 'dictation_session',
    label: 'Dictation sessions',
    credits: 0.25,
    enabled: true,
    billable: true,
    includeInTotalCredits: true,
  },
];

describe('buildAgentResourcesUsageVolumeRows', () => {
  it('does not expose a suggested-questions usage row id', () => {
    const summary: CustomerAgentResourcesUsageSummary = {
      totalCreditsUsed: 50,
      textMessages: 44,
      voiceMessages: 0,
      voiceDictationSessions: 0,
      suggestedQuestionMessages: 6,
      averageCreditsPerMessage: null,
      textCreditsAttributed: 44,
      voiceCreditsAttributed: 0,
      dictationCreditsAttributed: 0,
      suggestedQuestionCreditsAttributed: 6,
    };
    const rows = buildAgentResourcesUsageVolumeRows(summary, creditRules);
    expect(rows.some((r) => r.id === 'suggestedQuestionCredits')).toBe(false);
    const textRow = rows.find((r) => r.id === 'textCredits');
    expect(textRow?.magnitude).toBe(50);
    expect(textRow?.detailLine).toContain('50 messages');
    expect(rows.find((r) => r.id === 'totalCreditsUsed')?.magnitude).toBe(50);
  });

  it('merges legacy suggested attribution into text credits (dictation unchanged)', () => {
    const summary: CustomerAgentResourcesUsageSummary = {
      totalCreditsUsed: 34.5,
      textMessages: 30,
      voiceMessages: 2,
      voiceDictationSessions: 2,
      suggestedQuestionMessages: 0,
      averageCreditsPerMessage: null,
      textCreditsAttributed: 30,
      voiceCreditsAttributed: 4,
      dictationCreditsAttributed: 0.5,
      suggestedQuestionCreditsAttributed: 0,
    };
    const rows = buildAgentResourcesUsageVolumeRows(summary, creditRules);
    const dictRow = rows.find((r) => r.id === 'dictationCredits');
    expect(dictRow?.detailLine).toContain('2 sessions');
    expect(dictRow?.detailLine).toContain('0.25');
    expect(dictRow?.detailLine).toContain('0.5');
  });

  it('with componentRows, text row reflects merged breakdown-only counts', () => {
    const summary: CustomerAgentResourcesUsageSummary = {
      totalCreditsUsed: 50,
      ledgerCreditsTotal: 50,
      componentRows: [
        {
          key: 'text_message',
          label: 'Text messages',
          count: 50,
          creditsEach: 1,
          creditsUsed: 50,
          billable: true,
        },
      ],
      textMessages: 50,
      voiceMessages: 0,
      voiceDictationSessions: 0,
      suggestedQuestionMessages: 0,
      averageCreditsPerMessage: null,
    };
    const rows = buildAgentResourcesUsageVolumeRows(summary, creditRules);
    expect(rows.some((r) => r.id === 'suggestedQuestionCredits')).toBe(false);
    expect(rows.find((r) => r.id === 'textCredits')?.detailLine).toContain('50 messages');
    expect(rows.find((r) => r.id === 'textCredits')?.detailLine).toContain('50');
  });

  it('with componentRows, ignores stray legacy suggested_question_message rows on the payload', () => {
    const summary: CustomerAgentResourcesUsageSummary = {
      totalCreditsUsed: 53,
      componentRows: [
        {
          key: 'text_message',
          label: 'Text messages',
          count: 50,
          creditsEach: 1,
          creditsUsed: 50,
          billable: true,
        },
        {
          key: 'suggested_question_message',
          label: 'Suggested question',
          count: 3,
          creditsEach: 1,
          creditsUsed: 3,
          billable: true,
        },
      ],
      textMessages: 50,
      voiceMessages: 0,
      voiceDictationSessions: 0,
      suggestedQuestionMessages: 0,
      averageCreditsPerMessage: null,
    };
    const rows = buildAgentResourcesUsageVolumeRows(summary, creditRules);
    expect(rows.find((r) => r.id === 'textCredits')?.magnitude).toBe(50);
    expect(rows.find((r) => r.id === 'totalCreditsUsed')?.magnitude).toBe(53);
  });
});
