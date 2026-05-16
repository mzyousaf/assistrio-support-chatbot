import { Types } from 'mongoose';
import { roundUsageCredits, CustomerUsageAnalyticsService } from './customer-usage-analytics.service';

describe('CustomerUsageAnalyticsService', () => {
  it('roundUsageCredits preserves decimals', () => {
    expect(roundUsageCredits(1.23456789)).toBe(1.234568);
  });

  it('get uses ledger path when count > 0', async () => {
    let ledgerAggCalls = 0;
    const usageLedgerModel = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(2) }),
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => {
          ledgerAggCalls += 1;
          if (ledgerAggCalls === 1) return [];
          return [
            {
              totals: [
                {
                  totalCreditsUsed: 3.25,
                  totalBillableCredits: 3.25,
                  totalNonBillableCredits: 0,
                  totalUsageEvents: 2,
                  totalMessages: 2,
                  textMessages: 1,
                  voiceMessages: 1,
                  dictationMessages: 0,
                  attachmentMessages: 0,
                  suggestedQuestionMessages: 0,
                  voiceCreditsLedger: 2,
                  dictationCreditsLedger: 0,
                  dictationSessionsLedger: 0,
                },
              ],
              byBucket: [],
              byUsageType: [],
              byCreditRule: [],
            },
          ];
        }),
      }),
    };
    const messageModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            voiceMessages: 1,
            dictationMessages: 0,
            voiceCreditsUsed: 2,
            dictationCreditsUsed: 0,
            dictationSessions: 0,
            totalSpeechWords: 10,
            totalSpeechCharacters: 40,
            totalAudioDurationSeconds: 1.5,
          },
        ]),
      }),
    };

    const svc = new CustomerUsageAnalyticsService(usageLedgerModel as never, messageModel as never);
    const res = await svc.get(new Types.ObjectId().toString(), {});

    expect(res.summary.totalCreditsUsed).toBe(3.25);
    expect(res.summary.totalMessages).toBe(2);
    expect(res.dictationVoiceSummary.totalSpeechWords).toBe(10);
    expect(res.usageCreditRules.length).toBeGreaterThan(0);
    expect(res.componentBreakdownSummary.totalCreditsUsed).toBe(3.25);
    expect(usageLedgerModel.aggregate).toHaveBeenCalled();
  });
});
