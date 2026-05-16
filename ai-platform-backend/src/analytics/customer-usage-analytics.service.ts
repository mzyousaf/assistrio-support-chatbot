import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Message, UsageLedger } from '../models';
import type { UsageLedgerUsageType } from '../models/usage-ledger.schema';
import {
  PREVIEW_STARTED_FROM_VALUES,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  type CustomerChatsGranularity,
} from './customer-chats-analytics.util';
import {
  messageInputTypeToUsageLabel,
  parseCustomerUsageQuery,
  usageLedgerUsageTypeLabel,
  type CustomerUsageQueryInput,
  type ParsedCustomerUsageQuery,
} from './customer-usage-analytics.util';

export type CustomerUsageAnalyticsResponse = {
  range: { from: string; to: string; granularity: CustomerChatsGranularity };
  summary: {
    totalCreditsUsed: number;
    totalBillableCredits: number;
    totalNonBillableCredits: number;
    totalUsageEvents: number;
    totalMessages: number;
    textMessages: number;
    voiceMessages: number;
    dictationMessages: number;
    attachmentMessages: number;
    suggestedQuestionMessages: number;
    averageCreditsPerMessage: number | null;
  };
  timeSeries: Array<{
    date: string;
    creditsUsed: number;
    billableCredits: number;
    nonBillableCredits: number;
    usageEvents: number;
    messages: number;
    textMessages: number;
    voiceMessages: number;
    dictationMessages: number;
    attachmentMessages: number;
    suggestedQuestionMessages: number;
  }>;
  usageTypeBreakdown: Array<{
    usageType: string;
    label: string;
    events: number;
    creditsUsed: number;
    billableCredits: number;
    nonBillableCredits: number;
  }>;
  creditReasonBreakdown: Array<{
    creditReason: string;
    events: number;
    creditsUsed: number;
  }>;
  dictationVoiceSummary: {
    voiceMessages: number;
    dictationMessages: number;
    voiceCreditsUsed: number;
    dictationCreditsUsed: number;
    dictationSessions: number;
    totalSpeechWords: number;
    totalSpeechCharacters: number;
    totalAudioDurationSeconds: number;
  };
};

const USER_MESSAGE_USAGE_TYPES: UsageLedgerUsageType[] = [
  'text_message',
  'voice_message',
  'dictation_message',
  'attachment_message',
  'suggested_question_message',
  'quick_reply_message',
  'unknown_message',
];

const TEXT_LIKE_TYPES: UsageLedgerUsageType[] = [
  'text_message',
  'quick_reply_message',
  'unknown_message',
];

const VOICE_LIKE_TYPES: UsageLedgerUsageType[] = ['voice_message', 'stt_seconds'];

function chargedAtTruncExpr(granularity: CustomerChatsGranularity): Record<string, unknown> {
  const unit = mongoDateTruncUnit(granularity);
  const base: Record<string, unknown> = {
    date: '$chargedAt',
    unit,
    timezone: 'UTC',
  };
  if (unit === 'week') {
    base.startOfWeek = 'monday';
  }
  return { $dateTrunc: base };
}

function createdAtTruncExpr(granularity: CustomerChatsGranularity): Record<string, unknown> {
  const unit = mongoDateTruncUnit(granularity);
  const base: Record<string, unknown> = {
    date: '$createdAt',
    unit,
    timezone: 'UTC',
  };
  if (unit === 'week') {
    base.startOfWeek = 'monday';
  }
  return { $dateTrunc: base };
}

export function roundUsageCredits(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
}

@Injectable()
export class CustomerUsageAnalyticsService {
  constructor(
    @InjectModel(UsageLedger.name) private readonly usageLedgerModel: Model<UsageLedger>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
  ) {}

  async get(botId: string, queryIn: CustomerUsageQueryInput): Promise<CustomerUsageAnalyticsResponse> {
    const q = parseCustomerUsageQuery(queryIn);
    const oid = new Types.ObjectId(botId);
    const ledgerMatch = this.buildLedgerMatch(oid, q);

    const [ledgerCount, speechAgg] = await Promise.all([
      this.usageLedgerModel.countDocuments(ledgerMatch).exec(),
      this.aggregateSpeechFromMessages(oid, q),
    ]);

    if (ledgerCount > 0) {
      return this.buildFromLedger(q, ledgerMatch, speechAgg);
    }
    return this.buildFromMessages(q, speechAgg, oid);
  }

  private buildLedgerMatch(botId: Types.ObjectId, q: ParsedCustomerUsageQuery): Record<string, unknown> {
    const and: Record<string, unknown>[] = [
      { botId },
      { chargedAt: { $gte: q.from, $lte: q.to } },
    ];
    if (!q.includePreview) {
      and.push({
        $or: [
          { 'metadata.startedFrom': { $exists: false } },
          { 'metadata.startedFrom': null },
          { 'metadata.startedFrom': '' },
          { 'metadata.startedFrom': { $nin: [...PREVIEW_STARTED_FROM_VALUES] } },
        ],
      });
    }
    if (q.usageType) {
      and.push({ usageType: q.usageType });
    }
    return { $and: and };
  }

  private messagePreviewPipeline(q: ParsedCustomerUsageQuery): PipelineStage[] {
    const stages: PipelineStage[] = [
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: '_conv',
        },
      },
      { $unwind: { path: '$_conv', preserveNullAndEmptyArrays: false } },
    ];
    if (!q.includePreview) {
      stages.push({
        $match: {
          '_conv.startedFrom': { $nin: [...PREVIEW_STARTED_FROM_VALUES] },
        },
      });
    }
    if (q.usageType) {
      const mapLedgerToInput: Partial<Record<string, string>> = {
        text_message: 'text',
        voice_message: 'voice',
        dictation_message: 'dictation',
        attachment_message: 'attachment',
        suggested_question_message: 'suggested_question',
        quick_reply_message: 'quick_reply',
        unknown_message: 'unknown',
      };
      const it = mapLedgerToInput[q.usageType];
      if (it) {
        stages.push({ $match: { inputType: it } });
      }
    }
    return stages;
  }

  private async aggregateSpeechFromMessages(
    botId: Types.ObjectId,
    q: ParsedCustomerUsageQuery,
  ): Promise<CustomerUsageAnalyticsResponse['dictationVoiceSummary']> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          role: 'user',
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messagePreviewPipeline(q),
      {
        $group: {
          _id: null,
          voiceMessages: {
            $sum: {
              $cond: [{ $eq: ['$inputType', 'voice'] }, 1, 0],
            },
          },
          dictationMessages: {
            $sum: {
              $cond: [{ $eq: ['$inputType', 'dictation'] }, 1, 0],
            },
          },
          voiceCreditsUsed: {
            $sum: {
              $cond: [{ $eq: ['$inputType', 'voice'] }, { $ifNull: ['$creditCost', 0] }, 0],
            },
          },
          dictationCreditsUsed: {
            $sum: {
              $cond: [{ $eq: ['$inputType', 'dictation'] }, { $ifNull: ['$creditCost', 0] }, 0],
            },
          },
          dictationSessions: {
            $sum: {
              $cond: [
                { $eq: ['$inputType', 'dictation'] },
                {
                  $cond: [
                    { $gt: [{ $ifNull: ['$voiceMeta.dictationSessionCount', 0] }, 0] },
                    { $toDouble: { $ifNull: ['$voiceMeta.dictationSessionCount', 0] } },
                    1,
                  ],
                },
                0,
              ],
            },
          },
          totalSpeechWords: { $sum: { $ifNull: ['$voiceMeta.speechToTextWords', 0] } },
          totalSpeechCharacters: { $sum: { $ifNull: ['$voiceMeta.speechToTextCharacters', 0] } },
          totalAudioDurationSeconds: {
            $sum: {
              $add: [
                { $ifNull: ['$voiceMeta.audioDurationSeconds', 0] },
                {
                  $cond: [
                    { $gt: [{ $ifNull: ['$voiceMeta.dictationDurationSeconds', 0] }, 0] },
                    { $ifNull: ['$voiceMeta.dictationDurationSeconds', 0] },
                    {
                      $cond: [
                        { $gt: [{ $ifNull: ['$voiceMeta.speechDurationSeconds', 0] }, 0] },
                        { $ifNull: ['$voiceMeta.speechDurationSeconds', 0] },
                        0,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ];

    const rows = await this.messageModel.aggregate(pipeline).exec();
    const r = rows[0];
    if (!r) {
      return {
        voiceMessages: 0,
        dictationMessages: 0,
        voiceCreditsUsed: 0,
        dictationCreditsUsed: 0,
        dictationSessions: 0,
        totalSpeechWords: 0,
        totalSpeechCharacters: 0,
        totalAudioDurationSeconds: 0,
      };
    }
    return {
      voiceMessages: Math.trunc(r.voiceMessages ?? 0),
      dictationMessages: Math.trunc(r.dictationMessages ?? 0),
      voiceCreditsUsed: roundUsageCredits(Number(r.voiceCreditsUsed ?? 0)),
      dictationCreditsUsed: roundUsageCredits(Number(r.dictationCreditsUsed ?? 0)),
      dictationSessions: Math.trunc(r.dictationSessions ?? 0),
      totalSpeechWords: Math.trunc(r.totalSpeechWords ?? 0),
      totalSpeechCharacters: Math.trunc(r.totalSpeechCharacters ?? 0),
      totalAudioDurationSeconds: roundUsageCredits(Number(r.totalAudioDurationSeconds ?? 0)),
    };
  }

  private async buildFromLedger(
    q: ParsedCustomerUsageQuery,
    ledgerMatch: Record<string, unknown>,
    speechFromMessages: CustomerUsageAnalyticsResponse['dictationVoiceSummary'],
  ): Promise<CustomerUsageAnalyticsResponse> {
    const trunc = chargedAtTruncExpr(q.granularity);
    const userMsgCond = { $in: ['$usageType', USER_MESSAGE_USAGE_TYPES] };
    const textCond = { $in: ['$usageType', TEXT_LIKE_TYPES] };
    const voiceCond = { $in: ['$usageType', VOICE_LIKE_TYPES] };
    const dictCond = { $eq: ['$usageType', 'dictation_message'] };
    const attCond = { $eq: ['$usageType', 'attachment_message'] };
    const sugCond = { $eq: ['$usageType', 'suggested_question_message'] };

    const billableExpr = {
      $cond: [{ $eq: ['$metadata.billable', false] }, 0, { $ifNull: ['$creditsUsed', 0] }],
    };
    const nonBillableExpr = {
      $cond: [{ $eq: ['$metadata.billable', false] }, { $ifNull: ['$creditsUsed', 0] }, 0],
    };

    const facet = await this.usageLedgerModel
      .aggregate([
        { $match: ledgerMatch },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalCreditsUsed: { $sum: { $ifNull: ['$creditsUsed', 0] } },
                  totalBillableCredits: { $sum: billableExpr },
                  totalNonBillableCredits: { $sum: nonBillableExpr },
                  totalUsageEvents: { $sum: 1 },
                  totalMessages: { $sum: { $cond: [userMsgCond, 1, 0] } },
                  textMessages: { $sum: { $cond: [textCond, 1, 0] } },
                  voiceMessages: { $sum: { $cond: [voiceCond, 1, 0] } },
                  dictationMessages: { $sum: { $cond: [dictCond, 1, 0] } },
                  attachmentMessages: { $sum: { $cond: [attCond, 1, 0] } },
                  suggestedQuestionMessages: { $sum: { $cond: [sugCond, 1, 0] } },
                  voiceCreditsLedger: {
                    $sum: {
                      $cond: [{ $eq: ['$usageType', 'voice_message'] }, { $ifNull: ['$creditsUsed', 0] }, 0],
                    },
                  },
                  dictationCreditsLedger: {
                    $sum: {
                      $cond: [{ $eq: ['$usageType', 'dictation_message'] }, { $ifNull: ['$creditsUsed', 0] }, 0],
                    },
                  },
                  dictationSessionsLedger: {
                    $sum: {
                      $cond: [
                        dictCond,
                        {
                          $cond: [
                            { $gt: [{ $ifNull: ['$metadata.dictationSessionCount', 0] }, 0] },
                            { $toDouble: { $ifNull: ['$metadata.dictationSessionCount', 0] } },
                            1,
                          ],
                        },
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            byBucket: [
              {
                $group: {
                  _id: trunc,
                  creditsUsed: { $sum: { $ifNull: ['$creditsUsed', 0] } },
                  billableCredits: { $sum: billableExpr },
                  nonBillableCredits: { $sum: nonBillableExpr },
                  usageEvents: { $sum: 1 },
                  messages: { $sum: { $cond: [userMsgCond, 1, 0] } },
                  textMessages: { $sum: { $cond: [textCond, 1, 0] } },
                  voiceMessages: { $sum: { $cond: [voiceCond, 1, 0] } },
                  dictationMessages: { $sum: { $cond: [dictCond, 1, 0] } },
                  attachmentMessages: { $sum: { $cond: [attCond, 1, 0] } },
                  suggestedQuestionMessages: { $sum: { $cond: [sugCond, 1, 0] } },
                },
              },
            ],
            byUsageType: [
              {
                $group: {
                  _id: '$usageType',
                  events: { $sum: 1 },
                  creditsUsed: { $sum: { $ifNull: ['$creditsUsed', 0] } },
                  billableCredits: { $sum: billableExpr },
                  nonBillableCredits: { $sum: nonBillableExpr },
                },
              },
              { $sort: { creditsUsed: -1 as const } },
            ],
            byCreditRule: [
              {
                $group: {
                  _id: '$creditRule',
                  events: { $sum: 1 },
                  creditsUsed: { $sum: { $ifNull: ['$creditsUsed', 0] } },
                },
              },
              { $sort: { creditsUsed: -1 as const } },
            ],
          },
        },
      ])
      .exec();

    const f = facet[0] ?? { totals: [], byBucket: [], byUsageType: [], byCreditRule: [] };
    const t = f.totals[0] ?? {};

    const totalMessages = Math.trunc(t.totalMessages ?? 0);
    const totalCreditsUsed = roundUsageCredits(Number(t.totalCreditsUsed ?? 0));
    const avg =
      totalMessages > 0 && Number.isFinite(totalCreditsUsed)
        ? roundUsageCredits(totalCreditsUsed / totalMessages)
        : null;

    const summary: CustomerUsageAnalyticsResponse['summary'] = {
      totalCreditsUsed,
      totalBillableCredits: roundUsageCredits(Number(t.totalBillableCredits ?? 0)),
      totalNonBillableCredits: roundUsageCredits(Number(t.totalNonBillableCredits ?? 0)),
      totalUsageEvents: Math.trunc(t.totalUsageEvents ?? 0),
      totalMessages,
      textMessages: Math.trunc(t.textMessages ?? 0),
      voiceMessages: Math.trunc(t.voiceMessages ?? 0),
      dictationMessages: Math.trunc(t.dictationMessages ?? 0),
      attachmentMessages: Math.trunc(t.attachmentMessages ?? 0),
      suggestedQuestionMessages: Math.trunc(t.suggestedQuestionMessages ?? 0),
      averageCreditsPerMessage: avg,
    };

    const bucketMap = new Map<string, Omit<CustomerUsageAnalyticsResponse['timeSeries'][0], 'date'>>();

    for (const row of f.byBucket ?? []) {
      const d = row._id as Date;
      const key = bucketKeyIso(d);
      bucketMap.set(key, {
        creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
        billableCredits: roundUsageCredits(Number(row.billableCredits ?? 0)),
        nonBillableCredits: roundUsageCredits(Number(row.nonBillableCredits ?? 0)),
        usageEvents: Math.trunc(row.usageEvents ?? 0),
        messages: Math.trunc(row.messages ?? 0),
        textMessages: Math.trunc(row.textMessages ?? 0),
        voiceMessages: Math.trunc(row.voiceMessages ?? 0),
        dictationMessages: Math.trunc(row.dictationMessages ?? 0),
        attachmentMessages: Math.trunc(row.attachmentMessages ?? 0),
        suggestedQuestionMessages: Math.trunc(row.suggestedQuestionMessages ?? 0),
      });
    }

    const buckets = enumerateBucketStarts(q.from, q.to, q.granularity);
    const timeSeries: CustomerUsageAnalyticsResponse['timeSeries'] = buckets.map((d) => {
      const key = bucketKeyIso(d);
      const z = bucketMap.get(key) ?? {
        creditsUsed: 0,
        billableCredits: 0,
        nonBillableCredits: 0,
        usageEvents: 0,
        messages: 0,
        textMessages: 0,
        voiceMessages: 0,
        dictationMessages: 0,
        attachmentMessages: 0,
        suggestedQuestionMessages: 0,
      };
      return { date: key, ...z };
    });

    const usageTypeBreakdown: CustomerUsageAnalyticsResponse['usageTypeBreakdown'] = (f.byUsageType ?? []).map(
      (row: { _id: string; events: number; creditsUsed: number; billableCredits: number; nonBillableCredits: number }) => ({
        usageType: String(row._id ?? 'unknown'),
        label: usageLedgerUsageTypeLabel(String(row._id ?? 'unknown')),
        events: Math.trunc(row.events ?? 0),
        creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
        billableCredits: roundUsageCredits(Number(row.billableCredits ?? 0)),
        nonBillableCredits: roundUsageCredits(Number(row.nonBillableCredits ?? 0)),
      }),
    );

    const creditReasonBreakdown: CustomerUsageAnalyticsResponse['creditReasonBreakdown'] = (f.byCreditRule ?? [])
      .map((row: { _id: unknown; events: number; creditsUsed: number }) => ({
        creditReason: row._id == null || row._id === '' ? 'unknown' : String(row._id),
        events: Math.trunc(row.events ?? 0),
        creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
      }))
      .filter((x: { events: number; creditsUsed: number }) => x.events > 0 || x.creditsUsed > 0);

    const dictationVoiceSummary: CustomerUsageAnalyticsResponse['dictationVoiceSummary'] = {
      voiceMessages: Math.max(Math.trunc(t.voiceMessages ?? 0), speechFromMessages.voiceMessages),
      dictationMessages: Math.max(Math.trunc(t.dictationMessages ?? 0), speechFromMessages.dictationMessages),
      voiceCreditsUsed: roundUsageCredits(
        Math.max(Number(t.voiceCreditsLedger ?? 0), speechFromMessages.voiceCreditsUsed),
      ),
      dictationCreditsUsed: roundUsageCredits(
        Math.max(Number(t.dictationCreditsLedger ?? 0), speechFromMessages.dictationCreditsUsed),
      ),
      dictationSessions: Math.max(
        Math.trunc(t.dictationSessionsLedger ?? 0),
        speechFromMessages.dictationSessions,
      ),
      totalSpeechWords: speechFromMessages.totalSpeechWords,
      totalSpeechCharacters: speechFromMessages.totalSpeechCharacters,
      totalAudioDurationSeconds: speechFromMessages.totalAudioDurationSeconds,
    };

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary,
      timeSeries,
      usageTypeBreakdown,
      creditReasonBreakdown,
      dictationVoiceSummary,
    };
  }

  private async buildFromMessages(
    q: ParsedCustomerUsageQuery,
    speechFromMessages: CustomerUsageAnalyticsResponse['dictationVoiceSummary'],
    oid: Types.ObjectId,
  ): Promise<CustomerUsageAnalyticsResponse> {
    const trunc = createdAtTruncExpr(q.granularity);

    const baseMatch: Record<string, unknown> = {
      botId: oid,
      role: 'user',
      createdAt: { $gte: q.from, $lte: q.to },
    };
    if (q.usageType) {
      const map: Partial<Record<string, string>> = {
        text_message: 'text',
        voice_message: 'voice',
        dictation_message: 'dictation',
        attachment_message: 'attachment',
        suggested_question_message: 'suggested_question',
        quick_reply_message: 'quick_reply',
        unknown_message: 'unknown',
      };
      const it = map[q.usageType];
      if (it) baseMatch.inputType = it;
    }

    const pipeline: PipelineStage[] = [{ $match: baseMatch }, ...this.messagePreviewPipeline(q)];

    const facet = await this.messageModel
      .aggregate([
        ...pipeline,
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalCreditsUsed: { $sum: { $ifNull: ['$creditCost', 0] } },
                  totalMessages: { $sum: 1 },
                  textMessages: {
                    $sum: {
                      $cond: [{ $in: ['$inputType', ['text', 'quick_reply', 'unknown']] }, 1, 0],
                    },
                  },
                  voiceMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'voice'] }, 1, 0] },
                  },
                  dictationMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'dictation'] }, 1, 0] },
                  },
                  attachmentMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'attachment'] }, 1, 0] },
                  },
                  suggestedQuestionMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'suggested_question'] }, 1, 0] },
                  },
                },
              },
            ],
            byBucket: [
              {
                $group: {
                  _id: trunc,
                  creditsUsed: { $sum: { $ifNull: ['$creditCost', 0] } },
                  billableCredits: { $sum: { $ifNull: ['$creditCost', 0] } },
                  nonBillableCredits: { $sum: 0 },
                  usageEvents: { $sum: 1 },
                  messages: { $sum: 1 },
                  textMessages: {
                    $sum: {
                      $cond: [{ $in: ['$inputType', ['text', 'quick_reply', 'unknown']] }, 1, 0],
                    },
                  },
                  voiceMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'voice'] }, 1, 0] },
                  },
                  dictationMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'dictation'] }, 1, 0] },
                  },
                  attachmentMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'attachment'] }, 1, 0] },
                  },
                  suggestedQuestionMessages: {
                    $sum: { $cond: [{ $eq: ['$inputType', 'suggested_question'] }, 1, 0] },
                  },
                },
              },
            ],
            byInput: [
              {
                $group: {
                  _id: { $ifNull: ['$inputType', 'unknown'] },
                  events: { $sum: 1 },
                  creditsUsed: { $sum: { $ifNull: ['$creditCost', 0] } },
                },
              },
            ],
            byReason: [
              {
                $group: {
                  _id: { $ifNull: ['$creditReason', 'unknown'] },
                  events: { $sum: 1 },
                  creditsUsed: { $sum: { $ifNull: ['$creditCost', 0] } },
                },
              },
              { $sort: { creditsUsed: -1 as const } },
            ],
          },
        },
      ])
      .exec();

    const f = facet[0] ?? { totals: [], byBucket: [], byInput: [], byReason: [] };
    const t = f.totals[0] ?? {};
    const totalMessages = Math.trunc(t.totalMessages ?? 0);
    const totalCreditsUsed = roundUsageCredits(Number(t.totalCreditsUsed ?? 0));
    const avg =
      totalMessages > 0 && Number.isFinite(totalCreditsUsed)
        ? roundUsageCredits(totalCreditsUsed / totalMessages)
        : null;

    const summary: CustomerUsageAnalyticsResponse['summary'] = {
      totalCreditsUsed,
      totalBillableCredits: totalCreditsUsed,
      totalNonBillableCredits: 0,
      totalUsageEvents: totalMessages,
      totalMessages,
      textMessages: Math.trunc(t.textMessages ?? 0),
      voiceMessages: Math.trunc(t.voiceMessages ?? 0),
      dictationMessages: Math.trunc(t.dictationMessages ?? 0),
      attachmentMessages: Math.trunc(t.attachmentMessages ?? 0),
      suggestedQuestionMessages: Math.trunc(t.suggestedQuestionMessages ?? 0),
      averageCreditsPerMessage: avg,
    };

    const bucketMap = new Map<string, CustomerUsageAnalyticsResponse['timeSeries'][0]>();
    for (const row of f.byBucket ?? []) {
      const d = row._id as Date;
      const key = bucketKeyIso(d);
      bucketMap.set(key, {
        date: key,
        creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
        billableCredits: roundUsageCredits(Number(row.billableCredits ?? 0)),
        nonBillableCredits: roundUsageCredits(Number(row.nonBillableCredits ?? 0)),
        usageEvents: Math.trunc(row.usageEvents ?? 0),
        messages: Math.trunc(row.messages ?? 0),
        textMessages: Math.trunc(row.textMessages ?? 0),
        voiceMessages: Math.trunc(row.voiceMessages ?? 0),
        dictationMessages: Math.trunc(row.dictationMessages ?? 0),
        attachmentMessages: Math.trunc(row.attachmentMessages ?? 0),
        suggestedQuestionMessages: Math.trunc(row.suggestedQuestionMessages ?? 0),
      });
    }

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);
    const timeSeries: CustomerUsageAnalyticsResponse['timeSeries'] = bucketStarts.map((d) => {
      const key = bucketKeyIso(d);
      return (
        bucketMap.get(key) ?? {
          date: key,
          creditsUsed: 0,
          billableCredits: 0,
          nonBillableCredits: 0,
          usageEvents: 0,
          messages: 0,
          textMessages: 0,
          voiceMessages: 0,
          dictationMessages: 0,
          attachmentMessages: 0,
          suggestedQuestionMessages: 0,
        }
      );
    });

    const keyToUsageType = (inputType: string): string => {
      switch (inputType) {
        case 'text':
          return 'text_message';
        case 'voice':
          return 'voice_message';
        case 'dictation':
          return 'dictation_message';
        case 'attachment':
          return 'attachment_message';
        case 'suggested_question':
          return 'suggested_question_message';
        case 'quick_reply':
          return 'quick_reply_message';
        default:
          return 'unknown_message';
      }
    };

    const usageTypeBreakdown: CustomerUsageAnalyticsResponse['usageTypeBreakdown'] = (f.byInput ?? []).map(
      (row: { _id: string; events: number; creditsUsed: number }) => {
        const it = String(row._id ?? 'unknown');
        const usageType = keyToUsageType(it);
        return {
          usageType,
          label: messageInputTypeToUsageLabel(it),
          events: Math.trunc(row.events ?? 0),
          creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
          billableCredits: roundUsageCredits(Number(row.creditsUsed ?? 0)),
          nonBillableCredits: 0,
        };
      },
    );

    const creditReasonBreakdown: CustomerUsageAnalyticsResponse['creditReasonBreakdown'] = (f.byReason ?? [])
      .map((row: { _id: unknown; events: number; creditsUsed: number }) => ({
        creditReason: row._id == null || row._id === '' ? 'unknown' : String(row._id),
        events: Math.trunc(row.events ?? 0),
        creditsUsed: roundUsageCredits(Number(row.creditsUsed ?? 0)),
      }))
      .filter((x: { events: number; creditsUsed: number }) => x.events > 0 || x.creditsUsed > 0);

    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary,
      timeSeries,
      usageTypeBreakdown,
      creditReasonBreakdown,
      dictationVoiceSummary: speechFromMessages,
    };
  }
}
