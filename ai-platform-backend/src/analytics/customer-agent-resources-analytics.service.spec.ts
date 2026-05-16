import { Types } from 'mongoose';
import { CREDIT_RULE_FINGERPRINT_ORDER } from '../chat/message-credit.util';
import type { CustomerUsageAnalyticsResponse } from './customer-usage-analytics.service';
import { CustomerAgentResourcesAnalyticsService } from './customer-agent-resources-analytics.service';

function emptyUsageAnalyticsResponse(): CustomerUsageAnalyticsResponse {
  const iso = new Date().toISOString();
  return {
    range: { from: iso, to: iso, granularity: 'day' },
    summary: {
      totalCreditsUsed: 0,
      totalBillableCredits: 0,
      totalNonBillableCredits: 0,
      totalUsageEvents: 0,
      totalMessages: 0,
      textMessages: 0,
      voiceMessages: 0,
      dictationMessages: 0,
      attachmentMessages: 0,
      suggestedQuestionMessages: 0,
      averageCreditsPerMessage: null,
    },
    timeSeries: [],
    usageTypeBreakdown: [],
    creditReasonBreakdown: [],
    dictationVoiceSummary: {
      voiceMessages: 0,
      dictationMessages: 0,
      voiceCreditsUsed: 0,
      dictationCreditsUsed: 0,
      dictationSessions: 0,
      totalSpeechWords: 0,
      totalSpeechCharacters: 0,
      totalAudioDurationSeconds: 0,
    },
    usageCreditRules: [],
    componentBreakdownSummary: {
      totalCreditsUsed: 0,
      textMessages: 0,
      textCredits: 0,
      voiceMessages: 0,
      voiceCredits: 0,
      dictationSessions: 0,
      dictationCredits: 0,
      attachmentMessages: 0,
      attachmentCredits: 0,
      suggestedQuestionMessages: 0,
      suggestedQuestionCredits: 0,
      quickReplyMessages: 0,
      unknownMessages: 0,
    },
    componentBreakdownTimeSeries: [],
  };
}

describe('CustomerAgentResourcesAnalyticsService', () => {
  it('returns creditRules sourced from billing constants keys', async () => {
    const botId = new Types.ObjectId().toString();
    const customerUsageAnalyticsService = {
      get: jest.fn().mockResolvedValue(emptyUsageAnalyticsResponse()),
    };
    const messageModel = {
      aggregate: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]),
      })),
    };

    const svc = new CustomerAgentResourcesAnalyticsService(
      customerUsageAnalyticsService as never,
      messageModel as never,
    );
    const res = await svc.get(botId, {});

    expect(res.usage.creditRules.map((r) => r.usageType)).toEqual(CREDIT_RULE_FINGERPRINT_ORDER);
    expect(res.usage.summary.voiceDictationSessions).toBe(0);
    expect(res.usage.summary.ledgerCreditsTotal).toBe(0);
    expect(res.usage.summary.componentRows).toEqual([]);
    expect(res.usage.summary.totalCreditsUsed).toBe(0);
    expect(customerUsageAnalyticsService.get).toHaveBeenCalledWith(
      botId,
      expect.objectContaining({ granularity: 'day', includePreview: 'true' }),
    );
  });

  it('recomputes coherent totals from breakdown counts × billing units', async () => {
    const botId = new Types.ObjectId().toString();
    const usage = emptyUsageAnalyticsResponse();
    usage.summary.totalCreditsUsed = 73;
    usage.componentBreakdownSummary = {
      ...usage.componentBreakdownSummary,
      textMessages: 44,
      textCredits: 44,
      voiceMessages: 7,
      voiceCredits: 14,
      dictationSessions: 7,
      dictationCredits: 14,
      attachmentMessages: 0,
      attachmentCredits: 0,
      suggestedQuestionMessages: 0,
      suggestedQuestionCredits: 0,
      quickReplyMessages: 0,
      unknownMessages: 0,
    };

    const customerUsageAnalyticsService = {
      get: jest.fn().mockResolvedValue(usage),
    };
    const messageModel = {
      aggregate: jest.fn().mockImplementation(() => ({
        exec: jest.fn().mockResolvedValue([]),
      })),
    };

    const svc = new CustomerAgentResourcesAnalyticsService(
      customerUsageAnalyticsService as never,
      messageModel as never,
    );
    const res = await svc.get(botId, {});

    expect(res.usage.summary.ledgerCreditsTotal).toBe(73);
    expect(res.usage.summary.totalCreditsUsed).toBeCloseTo(59.75);
    expect(res.usage.summary.dictationCreditsAttributed).toBeCloseTo(1.75);
    expect(res.usage.summary.textCreditsAttributed).toBe(44);
    expect(res.usage.summary.voiceCreditsAttributed).toBe(14);
    const dictRow = res.usage.summary.componentRows.find((r) => r.key === 'dictation_session');
    expect(dictRow?.creditsUsed).toBeCloseTo(1.75);
    expect(dictRow?.count).toBe(7);
  });
});
