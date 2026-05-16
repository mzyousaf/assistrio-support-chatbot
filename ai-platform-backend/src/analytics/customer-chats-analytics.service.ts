import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Conversation, Message } from '../models';
import {
  ANALYTICS_UNKNOWN_PAGE_LABEL,
  PREVIEW_STARTED_FROM_VALUES,
  TOP_PAGES_BREAKDOWN_LIMIT,
  alignBucketStart,
  bucketKeyIso,
  enumerateBucketStarts,
  mongoDateTruncUnit,
  normalizeAnalyticsPageUrl,
  normalizeAnalyticsWebsiteOrigin,
  normalizeConversationStartedFrom,
  applyStartedFromToMessageLookup,
  buildStartedFromMatchClause,
  parseCustomerChatsAnalyticsQuery,
  sortStartedFromKeys,
  startedFromGroupId,
  startedFromLabel,
  type ConversationStartedFromKey,
  type CustomerChatsAnalyticsQueryInput,
  type CustomerChatsGranularity,
  type ParsedCustomerChatsAnalyticsQuery,
} from './customer-chats-analytics.util';

export type CustomerChatsAnalyticsResponse = {
  range: {
    from: string;
    to: string;
    granularity: CustomerChatsGranularity;
  };
  summary: {
    totalConversations: number;
    totalMessages: number;
    /** All user-role messages in range (for charts that exclude assistant replies). */
    totalUserMessages: number;
    /** User-role messages typed or sent as text / quick reply / suggested question (excludes voice-like). */
    userTextMessages: number;
    /** User-role messages sent as voice or dictation input. */
    userVoiceMessages: number;
    totalThumbsUp: number;
    totalThumbsDown: number;
    averageMessagesPerConversation: number;
  };
  timeSeries: Array<{
    date: string;
    conversations: number;
    messages: number;
    /** Per-bucket user messages (role=user). */
    userMessages: number;
    /** Per-bucket user messages with text-like input (see summary userTextMessages). */
    textMessages: number;
    /** Per-bucket user messages with voice or dictation input. */
    voiceMessages: number;
    thumbsUp: number;
    thumbsDown: number;
  }>;
  locationBreakdown: {
    countries: Array<{
      country: string | null;
      countryCode: string | null;
      conversations: number;
      messages: number;
    }>;
    cities: Array<{
      city: string | null;
      countryCode: string | null;
      conversations: number;
      messages: number;
    }>;
  };
  topPagesBreakdown: Array<{
    page: string;
    pageLabel: string;
    websiteOrigin: string | null;
    conversations: number;
    messages: number;
  }>;
  startedFromBreakdown: Array<{
    key: ConversationStartedFromKey;
    label: string;
    conversations: number;
    messages: number;
  }>;
};


function dateTruncStage(
  dateField: string,
  granularity: CustomerChatsGranularity,
): Record<string, unknown> {
  const unit = mongoDateTruncUnit(granularity);
  const base: Record<string, unknown> = {
    date: `$${dateField}`,
    unit,
    timezone: 'UTC',
  };
  if (unit === 'week') {
    base.startOfWeek = 'monday';
  }
  return { $dateTrunc: base };
}

@Injectable()
export class CustomerChatsAnalyticsService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
  ) {}

  /**
   * Tenant-scoped chats analytics (caller must verify bot workspace access).
   */
  async get(botId: string, queryIn: CustomerChatsAnalyticsQueryInput): Promise<CustomerChatsAnalyticsResponse> {
    const q = parseCustomerChatsAnalyticsQuery(queryIn);

    const oid = new Types.ObjectId(botId);

    const convMatch = this.buildConversationMatch(oid, q);

    const [
      totalConversations,
      msgTotals,
      tsConversations,
      tsMessages,
      locCountriesConv,
      locCitiesConv,
      locMsgCountries,
      locMsgCities,
      topPagesConv,
      topPagesMsg,
      sfConv,
      sfMsg,
      feedbackTotals,
      feedbackTimeSeries,
      tsUserTextVoice,
      userTextVoiceTotals,
    ] = await Promise.all([
      this.conversationModel.countDocuments(convMatch),
      this.aggregateMessageRoleTotals(oid, q, convMatch),
      this.aggregateConversationTimeSeries(convMatch, q.granularity),
      this.aggregateMessageTimeSeries(oid, q, convMatch, q.granularity),
      this.aggregateLocationCountriesConversations(convMatch),
      this.aggregateLocationCitiesConversations(convMatch),
      this.aggregateLocationCountriesMessages(oid, q, convMatch),
      this.aggregateLocationCitiesMessages(oid, q, convMatch),
      this.aggregateTopPagesConversations(convMatch),
      this.aggregateTopPagesMessages(oid, q, convMatch),
      this.aggregateStartedFromConversations(convMatch),
      this.aggregateStartedFromMessages(oid, q, convMatch),
      this.aggregateAssistantFeedbackCounts(oid, q),
      this.aggregateAssistantFeedbackTimeSeries(oid, q, q.granularity),
      this.aggregateUserTextVoiceTimeSeries(oid, q, q.granularity),
      this.aggregateUserTextVoiceTotals(oid, q),
    ]);

    const bucketStarts = enumerateBucketStarts(q.from, q.to, q.granularity);

    const timeSeries = bucketStarts.map((bucketStart) => {
      const key = bucketKeyIso(bucketStart);
      const fb = feedbackTimeSeries.get(key);
      const tv = tsUserTextVoice.get(key) ?? { text: 0, voice: 0 };
      const msgBucket = tsMessages.get(key);
      return {
        date: key,
        conversations: tsConversations.get(key) ?? 0,
        messages: msgBucket?.total ?? 0,
        userMessages: msgBucket?.user ?? 0,
        textMessages: tv.text,
        voiceMessages: tv.voice,
        thumbsUp: fb?.up ?? 0,
        thumbsDown: fb?.down ?? 0,
      };
    });

    const totalMessages = msgTotals.total;
    const avgMsgPerConv =
      totalConversations > 0 ? totalMessages / totalConversations : 0;
    return {
      range: {
        from: q.from.toISOString(),
        to: q.to.toISOString(),
        granularity: q.granularity,
      },
      summary: {
        totalConversations,
        totalMessages,
        totalUserMessages: msgTotals.user,
        userTextMessages: userTextVoiceTotals.text,
        userVoiceMessages: userTextVoiceTotals.voice,
        totalThumbsUp: feedbackTotals.up,
        totalThumbsDown: feedbackTotals.down,
        averageMessagesPerConversation: round4(avgMsgPerConv),
      },
      timeSeries,
      locationBreakdown: {
        countries: mergeLocationCountryRows(locCountriesConv, locMsgCountries),
        cities: mergeLocationCityRows(locCitiesConv, locMsgCities),
      },
      topPagesBreakdown: mergeTopPagesBreakdown(topPagesConv, topPagesMsg),
      startedFromBreakdown: buildStartedFromBreakdown(sfConv, sfMsg),
    };
  }

  private async aggregateAssistantFeedbackCounts(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
  ): Promise<{ up: number; down: number }> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          role: 'assistant',
          'feedback.rating': { $in: ['up', 'down'] },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $match: {
          $expr: {
            $and: [
              { $gte: [{ $ifNull: ['$feedback.createdAt', '$createdAt'] }, q.from] },
              { $lte: [{ $ifNull: ['$feedback.createdAt', '$createdAt'] }, q.to] },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$feedback.rating',
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{ _id: 'up' | 'down'; n: number }>(pipeline);
    let up = 0;
    let down = 0;
    for (const r of rows) {
      if (r._id === 'up') up = r.n;
      if (r._id === 'down') down = r.n;
    }
    return { up, down };
  }

  private async aggregateAssistantFeedbackTimeSeries(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    granularity: CustomerChatsGranularity,
  ): Promise<Map<string, { up: number; down: number }>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          role: 'assistant',
          'feedback.rating': { $in: ['up', 'down'] },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $addFields: {
          feedbackAt: { $ifNull: ['$feedback.createdAt', '$createdAt'] },
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gte: ['$feedbackAt', q.from] },
              { $lte: ['$feedbackAt', q.to] },
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            b: dateTruncStage('feedbackAt', granularity),
            rating: '$feedback.rating',
          },
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: { b: Date; rating: 'up' | 'down' };
      n: number;
    }>(pipeline);

    const out = new Map<string, { up: number; down: number }>();
    for (const r of rows) {
      if (!r._id?.b) continue;
      const key = bucketKeyIso(alignBucketStart(r._id.b, granularity));
      const cur = out.get(key) ?? { up: 0, down: 0 };
      if (r._id.rating === 'up') cur.up += r.n;
      if (r._id.rating === 'down') cur.down += r.n;
      out.set(key, cur);
    }
    return out;
  }

  private buildConversationMatch(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
  ): Record<string, unknown> {
    const and: Record<string, unknown>[] = [
      { botId },
      { createdAt: { $gte: q.from, $lte: q.to } },
    ];
    if (!q.includePreview) {
      and.push({ startedFrom: { $nin: [...PREVIEW_STARTED_FROM_VALUES] } });
    }
    if (q.startedFrom?.length) {
      and.push(buildStartedFromMatchClause('startedFrom', q.startedFrom));
    }
    if (q.countryCode) {
      and.push({ 'location.countryCode': q.countryCode });
    }
    if (q.deviceType) {
      and.push({ 'deviceInfo.deviceType': q.deviceType });
    }
    return { $and: and };
  }

  private messageLookupPipeline(q: ParsedCustomerChatsAnalyticsQuery): PipelineStage[] {
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

    const matchParts: Record<string, unknown> = {};
    if (!q.includePreview) {
      matchParts['_conv.startedFrom'] = { $nin: [...PREVIEW_STARTED_FROM_VALUES] };
    }
    applyStartedFromToMessageLookup(matchParts, stages, '_conv.startedFrom', q.startedFrom);
    if (q.countryCode) {
      matchParts['_conv.location.countryCode'] = q.countryCode;
    }
    if (q.deviceType) {
      matchParts['_conv.deviceInfo.deviceType'] = q.deviceType;
    }
    if (Object.keys(matchParts).length > 0) {
      stages.push({ $match: matchParts });
    }
    return stages;
  }

  private async aggregateMessageRoleTotals(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
  ): Promise<{ total: number; user: number; assistant: number }> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: '$role',
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{ _id: string; n: number }>(pipeline);
    let user = 0;
    let assistant = 0;
    for (const r of rows) {
      if (r._id === 'user') user = r.n;
      if (r._id === 'assistant') assistant = r.n;
    }
    return { total: user + assistant, user, assistant };
  }

  private async aggregateConversationTimeSeries(
    convMatch: Record<string, unknown>,
    granularity: CustomerChatsGranularity,
  ): Promise<Map<string, number>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: dateTruncStage('createdAt', granularity),
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{ _id: Date; n: number }>(pipeline);
    return toBucketMap(rows, granularity);
  }

  private async aggregateMessageTimeSeries(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
    granularity: CustomerChatsGranularity,
  ): Promise<Map<string, { total: number; user: number; assistant: number }>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: {
            b: dateTruncStage('createdAt', granularity),
            role: '$role',
          },
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: { b: Date; role: string };
      n: number;
    }>(pipeline);
    const out = new Map<string, { total: number; user: number; assistant: number }>();
    for (const r of rows) {
      const key = bucketKeyIso(alignBucketStart(r._id.b, granularity));
      const cur = out.get(key) ?? { total: 0, user: 0, assistant: 0 };
      if (r._id.role === 'user') cur.user += r.n;
      if (r._id.role === 'assistant') cur.assistant += r.n;
      cur.total = cur.user + cur.assistant;
      out.set(key, cur);
    }
    return out;
  }

  /**
   * User messages per time bucket: text-like vs voice-like (voice + dictation `inputType`).
   */
  private async aggregateUserTextVoiceTimeSeries(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    granularity: CustomerChatsGranularity,
  ): Promise<Map<string, { text: number; voice: number }>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          role: 'user',
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $addFields: {
          _voiceLike: { $in: ['$inputType', ['voice', 'dictation']] },
        },
      },
      {
        $group: {
          _id: {
            b: dateTruncStage('createdAt', granularity),
            kind: { $cond: [{ $eq: ['$_voiceLike', true] }, 'voice', 'text'] },
          },
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: { b: Date; kind: 'text' | 'voice' };
      n: number;
    }>(pipeline);
    const out = new Map<string, { text: number; voice: number }>();
    for (const r of rows) {
      if (!r._id?.b) continue;
      const key = bucketKeyIso(alignBucketStart(r._id.b, granularity));
      const cur = out.get(key) ?? { text: 0, voice: 0 };
      if (r._id.kind === 'voice') cur.voice += r.n;
      else cur.text += r.n;
      out.set(key, cur);
    }
    return out;
  }

  private async aggregateUserTextVoiceTotals(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
  ): Promise<{ text: number; voice: number }> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          role: 'user',
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $addFields: {
          _voiceLike: { $in: ['$inputType', ['voice', 'dictation']] },
        },
      },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$_voiceLike', true] }, 'voice', 'text'] },
          n: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{ _id: 'text' | 'voice'; n: number }>(pipeline);
    let text = 0;
    let voice = 0;
    for (const r of rows) {
      if (r._id === 'voice') voice += r.n;
      else text += r.n;
    }
    return { text, voice };
  }

  private async aggregateLocationCountriesConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ country: string | null; countryCode: string | null; conversations: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: {
            cc: '$location.countryCode',
            c: '$location.country',
          },
          conversations: { $sum: 1 },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 40 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { cc?: string | null; c?: string | null };
      conversations: number;
    }>(pipeline);
    return rows.map((r) => ({
      country: r._id.c ?? null,
      countryCode: r._id.cc ?? null,
      conversations: r.conversations,
    }));
  }

  private async aggregateLocationCitiesConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Array<{ city: string | null; countryCode: string | null; conversations: number }>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: {
            city: '$location.city',
            cc: '$location.countryCode',
          },
          conversations: { $sum: 1 },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 40 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { city?: string | null; cc?: string | null };
      conversations: number;
    }>(pipeline);
    return rows.map((r) => ({
      city: r._id.city ?? null,
      countryCode: r._id.cc ?? null,
      conversations: r.conversations,
    }));
  }

  private async aggregateLocationCountriesMessages(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
  ): Promise<Map<string, { country: string | null; countryCode: string | null; messages: number }>> {
    const keyOf = (cc: string | null, c: string | null) =>
      `${cc ?? ''}\u0000${c ?? ''}`;
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: {
            cc: '$_conv.location.countryCode',
            c: '$_conv.location.country',
          },
          messages: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: { cc?: string | null; c?: string | null };
      messages: number;
    }>(pipeline);
    const m = new Map<string, { country: string | null; countryCode: string | null; messages: number }>();
    for (const r of rows) {
      const cc = r._id.cc ?? null;
      const c = r._id.c ?? null;
      m.set(keyOf(cc, c), { country: c, countryCode: cc, messages: r.messages });
    }
    return m;
  }

  private async aggregateLocationCitiesMessages(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
  ): Promise<Map<string, { city: string | null; countryCode: string | null; messages: number }>> {
    const keyOf = (city: string | null, cc: string | null) =>
      `${city ?? ''}\u0000${cc ?? ''}`;
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: {
            city: '$_conv.location.city',
            cc: '$_conv.location.countryCode',
          },
          messages: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: { city?: string | null; cc?: string | null };
      messages: number;
    }>(pipeline);
    const m = new Map<string, { city: string | null; countryCode: string | null; messages: number }>();
    for (const r of rows) {
      const city = r._id.city ?? null;
      const cc = r._id.cc ?? null;
      m.set(keyOf(city, cc), { city, countryCode: cc, messages: r.messages });
    }
    return m;
  }

  private async aggregateTopPagesConversations(
    convMatch: Record<string, unknown>,
  ): Promise<
    Array<{
      pageUrl: string | null;
      websiteOrigin: string | null;
      conversations: number;
      messageRollup: number;
    }>
  > {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: {
            pageUrl: '$conversationOrigin.pageUrl',
            websiteOrigin: '$conversationOrigin.websiteOrigin',
          },
          conversations: { $sum: 1 },
          messageRollup: { $sum: { $ifNull: ['$totalMessages', 0] } },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: 120 },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: { pageUrl?: string | null; websiteOrigin?: string | null };
      conversations: number;
      messageRollup: number;
    }>(pipeline);
    return rows.map((r) => ({
      pageUrl: r._id.pageUrl ?? null,
      websiteOrigin: r._id.websiteOrigin ?? null,
      conversations: r.conversations,
      messageRollup: r.messageRollup,
    }));
  }

  private async aggregateTopPagesMessages(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
  ): Promise<Map<string, number>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: '$_conv.conversationOrigin.pageUrl',
          messages: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id?: string | null;
      messages: number;
    }>(pipeline);
    const m = new Map<string, number>();
    for (const r of rows) {
      const { page } = normalizeAnalyticsPageUrl(r._id);
      m.set(page, (m.get(page) ?? 0) + r.messages);
    }
    return m;
  }

  private async aggregateStartedFromConversations(
    convMatch: Record<string, unknown>,
  ): Promise<Map<ConversationStartedFromKey, number>> {
    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      {
        $group: {
          _id: startedFromGroupId(),
          conversations: { $sum: 1 },
        },
      },
    ];
    const rows = await this.conversationModel.aggregate<{
      _id: string;
      conversations: number;
    }>(pipeline);
    const m = new Map<ConversationStartedFromKey, number>();
    for (const r of rows) {
      const k = normalizeConversationStartedFrom(r._id);
      m.set(k, (m.get(k) ?? 0) + r.conversations);
    }
    return m;
  }

  private async aggregateStartedFromMessages(
    botId: Types.ObjectId,
    q: ParsedCustomerChatsAnalyticsQuery,
    _convMatch: Record<string, unknown>,
  ): Promise<Map<ConversationStartedFromKey, number>> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          botId,
          createdAt: { $gte: q.from, $lte: q.to },
        },
      },
      ...this.messageLookupPipeline(q),
      {
        $group: {
          _id: startedFromGroupId('$_conv.startedFrom'),
          messages: { $sum: 1 },
        },
      },
    ];
    const rows = await this.messageModel.aggregate<{
      _id: string;
      messages: number;
    }>(pipeline);
    const m = new Map<ConversationStartedFromKey, number>();
    for (const r of rows) {
      const k = normalizeConversationStartedFrom(r._id);
      m.set(k, (m.get(k) ?? 0) + r.messages);
    }
    return m;
  }
}

function toBucketMap(
  rows: Array<{ _id: Date; n: number }>,
  granularity: CustomerChatsGranularity,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(bucketKeyIso(alignBucketStart(r._id, granularity)), r.n);
  }
  return m;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}


function mergeLocationCountryRows(
  convRows: Array<{ country: string | null; countryCode: string | null; conversations: number }>,
  msgMap: Map<string, { country: string | null; countryCode: string | null; messages: number }>,
): Array<{ country: string | null; countryCode: string | null; conversations: number; messages: number }> {
  const keyOf = (cc: string | null, c: string | null) =>
    `${cc ?? ''}\u0000${c ?? ''}`;
  const outMap = new Map<
    string,
    { country: string | null; countryCode: string | null; conversations: number; messages: number }
  >();
  for (const r of convRows) {
    const k = keyOf(r.countryCode, r.country);
    outMap.set(k, {
      country: r.country,
      countryCode: r.countryCode,
      conversations: r.conversations,
      messages: 0,
    });
  }
  for (const [, v] of msgMap) {
    const k = keyOf(v.countryCode, v.country);
    const cur = outMap.get(k) ?? {
      country: v.country,
      countryCode: v.countryCode,
      conversations: 0,
      messages: 0,
    };
    cur.messages = v.messages;
    outMap.set(k, cur);
  }
  return [...outMap.values()].sort((a, b) => b.conversations + b.messages - (a.conversations + a.messages));
}

function mergeLocationCityRows(
  convRows: Array<{ city: string | null; countryCode: string | null; conversations: number }>,
  msgMap: Map<string, { city: string | null; countryCode: string | null; messages: number }>,
): Array<{ city: string | null; countryCode: string | null; conversations: number; messages: number }> {
  const keyOf = (city: string | null, cc: string | null) => `${city ?? ''}\u0000${cc ?? ''}`;
  const outMap = new Map<
    string,
    { city: string | null; countryCode: string | null; conversations: number; messages: number }
  >();
  for (const r of convRows) {
    const k = keyOf(r.city, r.countryCode);
    outMap.set(k, {
      city: r.city,
      countryCode: r.countryCode,
      conversations: r.conversations,
      messages: 0,
    });
  }
  for (const [, v] of msgMap) {
    const k = keyOf(v.city, v.countryCode);
    const cur = outMap.get(k) ?? {
      city: v.city,
      countryCode: v.countryCode,
      conversations: 0,
      messages: 0,
    };
    cur.messages = v.messages;
    outMap.set(k, cur);
  }
  return [...outMap.values()].sort((a, b) => b.conversations + b.messages - (a.conversations + a.messages));
}

type TopPagesBreakdownRow = CustomerChatsAnalyticsResponse['topPagesBreakdown'][number];

function hostFromNormalizedPage(page: string): string | null {
  if (!page || page === ANALYTICS_UNKNOWN_PAGE_LABEL) return null;
  const slash = page.indexOf('/');
  return slash === -1 ? page : page.slice(0, slash);
}

function mergeTopPagesBreakdown(
  convRows: Array<{
    pageUrl: string | null;
    websiteOrigin: string | null;
    conversations: number;
    messageRollup: number;
  }>,
  msgMap: Map<string, number>,
): TopPagesBreakdownRow[] {
  const outMap = new Map<
    string,
    {
      page: string;
      pageLabel: string;
      websiteOrigin: string | null;
      conversations: number;
      messages: number;
    }
  >();

  for (const r of convRows) {
    const { page, pageLabel } = normalizeAnalyticsPageUrl(r.pageUrl);
    const origin =
      normalizeAnalyticsWebsiteOrigin(r.websiteOrigin) ?? hostFromNormalizedPage(page);
    const cur = outMap.get(page) ?? {
      page,
      pageLabel,
      websiteOrigin: origin,
      conversations: 0,
      messages: 0,
    };
    cur.conversations += r.conversations;
    if (origin && !cur.websiteOrigin) cur.websiteOrigin = origin;
    if (r.messageRollup > 0) cur.messages += r.messageRollup;
    outMap.set(page, cur);
  }

  for (const [page, msgCount] of msgMap) {
    const cur = outMap.get(page) ?? {
      page,
      pageLabel: page,
      websiteOrigin: hostFromNormalizedPage(page),
      conversations: 0,
      messages: 0,
    };
    if (cur.messages === 0 && msgCount > 0) cur.messages = msgCount;
    outMap.set(page, cur);
  }

  return [...outMap.values()]
    .sort((a, b) => b.conversations - a.conversations || b.messages - a.messages)
    .slice(0, TOP_PAGES_BREAKDOWN_LIMIT);
}

function buildStartedFromBreakdown(
  convMap: Map<ConversationStartedFromKey, number>,
  msgMap: Map<ConversationStartedFromKey, number>,
): CustomerChatsAnalyticsResponse['startedFromBreakdown'] {
  const keys = sortStartedFromKeys([
    ...new Set([...convMap.keys(), ...msgMap.keys()]),
  ] as ConversationStartedFromKey[]);
  return keys.map((key) => ({
    key,
    label: startedFromLabel(key),
    conversations: convMap.get(key) ?? 0,
    messages: msgMap.get(key) ?? 0,
  }));
}
