import { Types } from 'mongoose';
import {
  buildWorkspaceLeadsAggregationPipeline,
  customerLeadFieldDefinitionsFromBot,
  extractCapturedLeadFieldMessageIdsForWorkspace,
  isSafeCustomerAttachmentHttpUrl,
  maskChatVisitorIdForList,
  mergeCustomerLeadFieldDefinitions,
  parseWorkspaceLeadsListFilters,
  sanitizeLeadFieldKeyFilter,
  serializeCustomerWorkspaceLeadDetail,
  serializeCustomerWorkspaceLeadListRow,
  serializeMessageAiMetaForWorkspace,
  serializeMessageFeedbackForWorkspace,
  serializeWorkspaceConversationDetail,
  serializeWorkspaceConversationListRow,
  serializeWorkspaceMessageAttachment,
  serializeWorkspaceMessageRow,
} from './workspace-conversation-serialize.util';

describe('serializeWorkspaceConversationListRow', () => {
  it('includes startedFrom, sessionSource, counters, and flags', () => {
    const id = new Types.ObjectId();
    const row = serializeWorkspaceConversationListRow(
      {
        _id: id,
        chatVisitorId: 'visitor-long-id-1234567890',
        sessionSource: 'runtime',
        startedFrom: 'runtime_widget',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        lastActivityAt: new Date('2024-01-03T00:00:00.000Z'),
        startedAt: new Date('2024-01-02T00:00:01.000Z'),
        totalUserMessages: 2,
        totalAssistantMessages: 2,
        totalMessages: 4,
        textMessageCount: 3,
        voiceMessageCount: 1,
        dictationMessageCount: 0,
        attachmentMessageCount: 0,
        suggestedQuestionMessageCount: 0,
        totalCreditsUsed: 5,
        sourcesUsedCount: 2,
        hasLead: true,
        hasVoice: true,
        hasDictation: false,
        hasAttachment: false,
        status: 'active',
        conversationOrigin: {
          source: 'script_embed',
          mode: 'runtime',
          embedType: 'script',
          websiteOrigin: 'https://example.com',
          pageUrl: 'https://example.com/p',
          referrer: 'https://ref',
        },
        location: { country: 'US', countryCode: 'US', region: 'CA', city: 'SF', timezone: 'America/Los_Angeles' },
        deviceInfo: { deviceType: 'desktop', browser: 'Chrome', os: 'Windows', language: 'en-US' },
      },
      { userPreview: 'hi', assistantPreview: 'hello' },
    );
    expect(row.startedFrom).toBe('runtime_widget');
    expect(row.sessionSource).toBe('runtime');
    expect(row.totalCreditsUsed).toBe(5);
    expect(row.sourcesUsedCount).toBe(2);
    expect(row.hasLead).toBe(true);
    expect(row.hasVoice).toBe(true);
    expect(row.conversationOrigin).toMatchObject({
      source: 'script_embed',
      mode: 'runtime',
      embedType: 'script',
    });
    expect(typeof row.chatVisitorId).toBe('string');
    expect(row.chatVisitorId).not.toContain('visitor-long-id');
  });

  it('includes conversationTopics and conversationSentiment when present on the thread', () => {
    const id = new Types.ObjectId();
    const row = serializeWorkspaceConversationListRow(
      {
        _id: id,
        chatVisitorId: 'v1',
        sessionSource: 'runtime',
        startedFrom: 'runtime_widget',
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        lastActivityAt: new Date('2024-01-03T00:00:00.000Z'),
        startedAt: new Date('2024-01-02T00:00:01.000Z'),
        totalUserMessages: 1,
        totalAssistantMessages: 1,
        totalMessages: 2,
        textMessageCount: 2,
        voiceMessageCount: 0,
        dictationMessageCount: 0,
        attachmentMessageCount: 0,
        suggestedQuestionMessageCount: 0,
        totalCreditsUsed: 0,
        sourcesUsedCount: 0,
        hasLead: false,
        hasVoice: false,
        hasDictation: false,
        hasAttachment: false,
        status: 'active',
        conversationTopics: {
          primaryTopic: 'pricing',
          topicLabels: ['pricing', 'billing'],
          primarySubTopic: 'plan_price',
          subTopicLabels: ['plan_price', 'failed_payment', 'bogus_sub'],
        },
        conversationSentiment: { label: 'positive', score: 0.5 },
      },
      { userPreview: 'hi', assistantPreview: 'hello' },
    );
    expect(row.conversationTopics).toMatchObject({
      primaryTopic: 'pricing',
      topicLabels: ['pricing', 'billing'],
      primarySubTopic: 'plan_price',
      subTopicLabels: ['plan_price', 'failed_payment'],
    });
    expect(row.conversationSentiment).toMatchObject({ label: 'positive', score: expect.any(Number) });
  });
});

describe('serializeWorkspaceConversationDetail', () => {
  it('includes capturedLeadData keys and sanitized values for workspace dashboards', () => {
    const id = new Types.ObjectId();
    const detail = serializeWorkspaceConversationDetail(
      {
        _id: id,
        botId: new Types.ObjectId(),
        chatVisitorId: 'anon-visitor-abcdef',
        sessionId: 'sess-uuid',
        capturedLeadData: { email: 'user@example.com', name: 'Alice' },
        leadFieldKeys: ['email'],
        hasLead: true,
        conversationSentiment: { label: 'positive', score: 0.84 },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
      '507f1f77bcf86cd799439011',
    );
    expect(detail.capturedLeadData).toEqual({ email: 'user@example.com', name: 'Alice' });
    expect(detail.conversationSentiment).toMatchObject({ label: 'positive', score: expect.any(Number) });
    expect(detail.chatVisitorId).toBe('anon-visitor-abcdef');
    expect(detail.sessionId).toBe('sess-uuid');
    expect(detail.leadFieldKeys).toEqual(['email']);
  });

  it('includes conversationTopics and mixed conversationSentiment when present', () => {
    const id = new Types.ObjectId();
    const detail = serializeWorkspaceConversationDetail(
      {
        _id: id,
        botId: new Types.ObjectId(),
        chatVisitorId: 'anon-visitor',
        conversationTopics: {
          primaryTopic: 'pricing',
          topicLabels: ['pricing', 'billing'],
          primarySubTopic: 'discount',
          subTopicLabels: ['discount', 'invoice'],
        },
        conversationSentiment: { label: 'mixed', score: 0.12 },
        createdAt: new Date(),
        lastActivityAt: new Date(),
      },
      '507f1f77bcf86cd799439011',
    );
    expect(detail.conversationTopics).toMatchObject({
      primaryTopic: 'pricing',
      topicLabels: ['pricing', 'billing'],
      primarySubTopic: 'discount',
      subTopicLabels: ['discount', 'invoice'],
    });
    expect(detail.conversationSentiment).toMatchObject({ label: 'mixed', score: expect.any(Number) });
  });
});

describe('serializeWorkspaceMessageRow', () => {
  it('includes messageId, inputType, creditCost for user messages', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'typed',
      createdAt: new Date('2024-06-01T12:00:00.000Z'),
      inputType: 'text',
      inputMethod: 'keyboard',
      creditCost: 3,
      creditReason: 'user_message',
      billingType: 'included',
      quotaPeriod: '2024-06',
      chargedAt: new Date('2024-06-01T12:00:01.000Z'),
    });
    expect(row.messageId).toBe(mid.toString());
    expect(row.inputType).toBe('text');
    expect(row.creditCost).toBe(3);
  });

  it('includes attachments without safe url (internal s3 url stripped)', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'hi',
      createdAt: new Date(),
      attachments: [{ name: 'report.pdf', mimeType: 'application/pdf', size: 1024, url: 's3://bucket/key' }],
    });
    expect(Array.isArray(row.attachments)).toBe(true);
    const att = (row.attachments as Record<string, unknown>[])[0];
    expect(att.name).toBe('report.pdf');
    expect(att.mimeType).toBe('application/pdf');
    expect(att.size).toBe(1024);
    expect(att.url).toBeUndefined();
    expect(att).not.toHaveProperty('bucket');
  });

  it('includes safe https attachment url', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'hi',
      createdAt: new Date(),
      attachments: [
        {
          name: 'x.png',
          mimeType: 'image/png',
          url: 'https://cdn.example.com/signed/x.png?token=abc',
        },
      ],
    });
    const att = (row.attachments as { url: string }[])[0];
    expect(att.url).toMatch(/^https:\/\//);
  });

  it('does not pass through bucket or key on attachments', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'hi',
      createdAt: new Date(),
      attachments: [
        {
          name: 'a.bin',
          mimeType: 'application/octet-stream',
          url: 'https://ok.example/file',
          bucket: 'secret-bucket',
          key: 'secret/key',
        } as Record<string, unknown>,
      ],
    });
    const att = (row.attachments as Record<string, unknown>[])[0];
    expect(att).not.toHaveProperty('bucket');
    expect(att).not.toHaveProperty('key');
  });

  it('includes sources and aiMeta for assistant messages', () => {
    const mid = new Types.ObjectId();
    const kb = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'assistant',
      content: 'reply',
      createdAt: new Date(),
      sources: [
        {
          sourceType: 'document',
          knowledgeBaseItemId: kb,
          sourceTitle: 'Doc',
          chunkId: 'c1',
          score: 0.9,
          preview: 'excerpt',
          docId: 'd1',
          docTitle: 'Doc',
          usedAt: new Date(),
        },
      ],
      aiMeta: {
        modelUsed: 'gpt-4o-mini',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        ragUsed: true,
        sourcesCount: 1,
        fallbackUsed: false,
      },
    });
    expect(Array.isArray(row.sources)).toBe(true);
    expect((row.sources as { knowledgeBaseItemId: string }[])[0].knowledgeBaseItemId).toBe(kb.toString());
    expect((row.sources as { score: number }[])[0].score).toBe(0.9);
    expect((row.aiMeta as { modelUsed: string }).modelUsed).toBe('gpt-4o-mini');
  });

  it('serializes source score 0', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'assistant',
      content: 'reply',
      createdAt: new Date(),
      sources: [
        {
          sourceType: 'document',
          chunkId: 'c1',
          preview: 'x',
          score: 0,
          usedAt: new Date(),
        },
      ],
    });
    expect((row.sources as { score: number }[])[0].score).toBe(0);
  });

  it('includes feedback for assistant messages when set', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'assistant',
      content: 'reply',
      createdAt: new Date('2024-06-01T12:00:00.000Z'),
      feedback: {
        rating: 'up',
        createdAt: new Date('2024-06-01T12:00:01.000Z'),
        updatedAt: new Date('2024-06-01T12:00:02.000Z'),
      },
    });
    expect(row.feedback).toEqual({
      rating: 'up',
      createdAt: '2024-06-01T12:00:01.000Z',
      updatedAt: '2024-06-01T12:00:02.000Z',
    });
  });

  it('includes sanitized topics and sentiment for user messages (no reason)', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'hello',
      createdAt: new Date(),
      topics: {
        primaryTopic: 'billing',
        topicLabels: ['billing', 'technical_support', 'nope'],
        topicConfidence: 0.91002,
        primarySubTopic: 'failed_payment',
        subTopicLabels: ['failed_payment', 'invoice', 'wordpress'],
      },
      sentiment: { label: 'negative', score: -0.61999, reason: 'Should never leak' },
    });
    expect(row.topics).toMatchObject({
      primaryTopic: 'billing',
      topicLabels: ['billing', 'technical_support', 'other'],
      topicConfidence: 0.91,
      primarySubTopic: 'failed_payment',
      subTopicLabels: ['failed_payment', 'invoice'],
    });
    expect(row.sentiment).toEqual({ label: 'negative', score: -0.62 });
    expect(JSON.stringify(row)).not.toContain('reason');
    expect(JSON.stringify(row)).not.toContain('Should never leak');
  });

  it('maps invalid user message primary topic to other and drops invalid sentiment labels', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'user',
      content: 'x',
      createdAt: new Date(),
      topics: { primaryTopic: 'not_a_taxonomy_id' },
      sentiment: { label: 'delighted', score: 0.4 },
    });
    expect(row.topics).toMatchObject({ primaryTopic: 'other' });
    expect(row.sentiment).toEqual({ score: 0.4 });
  });

  it('does not attach topics or sentiment to assistant messages even when present on document', () => {
    const mid = new Types.ObjectId();
    const row = serializeWorkspaceMessageRow({
      _id: mid,
      role: 'assistant',
      content: 'reply',
      createdAt: new Date(),
      topics: { primaryTopic: 'billing' },
      sentiment: { label: 'positive', score: 1 },
    });
    expect(row).not.toHaveProperty('topics');
    expect(row).not.toHaveProperty('sentiment');
  });
});

describe('serializeWorkspaceMessageAttachment', () => {
  it('maps filename and sizeBytes', () => {
    const out = serializeWorkspaceMessageAttachment({
      filename: 'doc.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 2048,
    });
    expect(out?.name).toBe('doc.docx');
    expect(out?.mimeType).toContain('wordprocessingml');
    expect(out?.size).toBe(2048);
  });

  it('prefers first safe url among candidates', () => {
    const out = serializeWorkspaceMessageAttachment({
      name: 'a',
      mimeType: 'text/plain',
      url: 's3://b/k',
      downloadUrl: 'https://example.com/get/a',
    });
    expect(out?.url).toBe('https://example.com/get/a');
  });
});

describe('isSafeCustomerAttachmentHttpUrl', () => {
  it('rejects s3 and file', () => {
    expect(isSafeCustomerAttachmentHttpUrl('s3://b/k')).toBe(false);
    expect(isSafeCustomerAttachmentHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('accepts http(s)', () => {
    expect(isSafeCustomerAttachmentHttpUrl('https://a.com/x')).toBe(true);
    expect(isSafeCustomerAttachmentHttpUrl('http://a.com/x')).toBe(true);
  });
});

describe('serializeMessageFeedbackForWorkspace', () => {
  it('omits invalid rating', () => {
    expect(serializeMessageFeedbackForWorkspace({ rating: 'sideways' } as never)).toBeUndefined();
  });
});

describe('serializeMessageAiMetaForWorkspace', () => {
  it('strips control characters from errorMessage', () => {
    const m = serializeMessageAiMetaForWorkspace({
      errorMessage: 'bad\u0000request',
    });
    expect(m?.errorMessage).toBe('bad request');
  });
});

describe('maskChatVisitorIdForList', () => {
  it('shortens long ids', () => {
    expect(maskChatVisitorIdForList('abcdefghijklmnop')).toMatch(/…/);
  });
});

describe('customer leads API helpers', () => {
  const botOid = new Types.ObjectId();

  it('customerLeadFieldDefinitionsFromBot reflects bot.leadCapture.fields with order', () => {
    const defs = customerLeadFieldDefinitionsFromBot({
      enabled: true,
      fields: [
        { key: 'budget', label: 'Budget', type: 'text', required: false },
        { key: 'email', label: 'Email', type: 'email', required: true },
      ],
    });
    expect(defs.map((d) => d.key)).toEqual(['budget', 'email']);
    expect(defs[0].label).toBe('Budget');
    expect(defs[0].order).toBe(0);
    expect(defs[1].type).toBe('email');
    expect(defs.every((d) => d.fieldStatus === 'active')).toBe(true);
  });

  it('buildWorkspaceLeadsAggregationPipeline matches hasLead and botId', () => {
    const pipeline = buildWorkspaceLeadsAggregationPipeline({
      botOid,
      filters: null,
      beforeSortAtIso: null,
      limit: 10,
    });
    const first = pipeline[0] as { $match?: Record<string, unknown> };
    expect(first.$match).toEqual({
      $and: [{ botId: botOid }, { hasLead: true }],
    });
  });

  it('sanitizeLeadFieldKeyFilter rejects dotted keys', () => {
    expect(sanitizeLeadFieldKeyFilter('a.b')).toBeUndefined();
    expect(sanitizeLeadFieldKeyFilter('email')).toBe('email');
  });

  describe('mergeCustomerLeadFieldDefinitions', () => {
    it('adds archived defs for captured keys not in active bot fields', () => {
      const defs = mergeCustomerLeadFieldDefinitions(
        {
          enabled: true,
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: false },
            { key: 'email', label: 'Email', type: 'email', required: false },
          ],
        },
        ['company_size'],
      );
      const arch = defs.find((d) => d.key === 'company_size');
      expect(arch?.archived).toBe(true);
      expect(arch?.fieldStatus).toBe('deleted');
      expect(arch?.source).toBe('captured_data');
      expect(String(arch?.label)).toMatch(/company/i);
    });

    it('prefers current bot label when key remains configured', () => {
      const defs = mergeCustomerLeadFieldDefinitions(
        {
          enabled: true,
          fields: [{ key: 'budget', label: 'Quarterly budget', type: 'number', required: false }],
        },
        ['budget'],
      );
      expect(defs[0]?.label).toBe('Quarterly budget');
      expect(defs[0]?.archived).toBe(false);
      expect(defs[0]?.fieldStatus).toBe('active');
    });

    it('marks disabled bot fields with captured values as archived', () => {
      const defs = mergeCustomerLeadFieldDefinitions(
        {
          enabled: true,
          fields: [
            { key: 'legacy', label: 'Legacy field', type: 'text', disabled: true },
            { key: 'email', label: 'Email', type: 'email', required: false },
          ],
        },
        ['legacy'],
      );
      const legacy = defs.find((d) => d.key === 'legacy');
      expect(legacy?.archived).toBe(true);
      expect(legacy?.fieldStatus).toBe('inactive');
      expect(legacy?.label).toBe('Legacy field');
    });

    it('uses capturedLeadFieldMeta label over humanized key for unknown keys', () => {
      const defs = mergeCustomerLeadFieldDefinitions(
        {
          enabled: true,
          fields: [{ key: 'email', label: 'Email', type: 'email', required: false }],
        },
        ['budget'],
        { budget: { label: 'Marketing budget', type: 'text' } },
      );
      const row = defs.find((d) => d.key === 'budget');
      expect(row?.label).toBe('Marketing budget');
      expect(row?.type).toBe('text');
      expect(row?.fieldStatus).toBe('deleted');
    });
  });

  it('parseWorkspaceLeadsListFilters passes safe fieldKey only', () => {
    const f = parseWorkspaceLeadsListFilters({ fieldKey: 'evil.key', search: ' acme ' });
    expect(f.fieldKey).toBeNull();
    expect(f.search).toBe('acme');
  });

  it('parseWorkspaceLeadsListFilters accepts leadCompletion complete or partial only', () => {
    expect(parseWorkspaceLeadsListFilters({ leadCompletion: 'complete' }).leadCompletion).toBe('complete');
    expect(parseWorkspaceLeadsListFilters({ leadCompletion: 'PARTIAL' }).leadCompletion).toBe('partial');
    expect(parseWorkspaceLeadsListFilters({ leadCompletion: 'nope' }).leadCompletion).toBeNull();
  });

  it('serializeCustomerWorkspaceLeadListRow omits ipHash and keeps flexible capturedLeadData', () => {
    const id = new Types.ObjectId();
    const row = serializeCustomerWorkspaceLeadListRow(
      {
        _id: id,
        botId: botOid,
        hasLead: true,
        capturedLeadData: { custom_key: 'value', email: 'x@y.com' },
        leadFieldKeys: ['custom_key', 'email'],
        leadCapturedAt: new Date('2025-01-05T12:00:00.000Z'),
        lastActivityAt: new Date('2025-01-06T12:00:00.000Z'),
        totalMessages: 3,
        totalCreditsUsed: 7,
        location: {
          country: 'PK',
          countryCode: 'PK',
          city: 'Lahore',
          ipHash: 'hashed',
        },
        deviceInfo: { deviceType: 'mobile', browser: 'Chrome', os: 'Android', userAgentHash: 'ua-h' },
        conversationOrigin: { pageUrl: 'https://x.com/p', websiteOrigin: 'https://x.com', referrer: 'https://r' },
      } as Record<string, unknown>,
      botOid.toString(),
    );
    expect(row.capturedLeadData).toEqual({ custom_key: 'value', email: 'x@y.com' });
    expect(row.location).toEqual({ country: 'PK', countryCode: 'PK', city: 'Lahore' });
    expect(JSON.stringify(row)).not.toContain('ipHash');
    expect(JSON.stringify(row)).not.toContain('userAgent');
  });

  it('serializeCustomerWorkspaceLeadDetail includes capturedLeadFieldMessageIds as string map', () => {
    const id = new Types.ObjectId();
    const midEmail = new Types.ObjectId();
    const midName = new Types.ObjectId();
    const detail = serializeCustomerWorkspaceLeadDetail(
      {
        _id: id,
        botId: botOid,
        hasLead: true,
        capturedLeadData: { email: 'a@b.co', name: 'Ann' },
        capturedLeadFieldMessageIds: { email: midEmail, name: midName },
        leadCapturedAt: new Date('2025-01-05T12:00:00.000Z'),
        totalUserMessages: 2,
        totalAssistantMessages: 2,
        totalMessages: 4,
        totalCreditsUsed: 0,
        sourcesUsedCount: 0,
      } as Record<string, unknown>,
      botOid.toString(),
    );
    expect(detail.capturedLeadFieldMessageIds).toEqual({
      email: midEmail.toString(),
      name: midName.toString(),
    });
  });

  it('extractCapturedLeadFieldMessageIdsForWorkspace accepts string ids', () => {
    const m = extractCapturedLeadFieldMessageIdsForWorkspace({
      capturedLeadFieldMessageIds: { phone: '507f1f77bcf86cd799439011' },
    } as Record<string, unknown>);
    expect(m).toEqual({ phone: '507f1f77bcf86cd799439011' });
  });
});
