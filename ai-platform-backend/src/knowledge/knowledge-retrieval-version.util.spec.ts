import { Types } from 'mongoose';
import {
  buildRetrievalConfigFingerprint,
  buildRetrievalKnowledgeVersionStamp,
} from './knowledge-retrieval-version.util';

describe('knowledge-retrieval-version.util', () => {
  it('buildRetrievalConfigFingerprint changes when includeNotes toggles', () => {
    const a = buildRetrievalConfigFingerprint({ includeNotesInKnowledge: true });
    const b = buildRetrievalConfigFingerprint({ includeNotesInKnowledge: false });
    expect(a).not.toBe(b);
  });

  it('buildRetrievalKnowledgeVersionStamp uses eligible items only', async () => {
    const botOid = new Types.ObjectId();
    const maxUpdated = new Date('2024-01-15T10:00:00.000Z');
    const itemModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: async () => [{ maxUpdated }],
      }),
    };

    const stamp = await buildRetrievalKnowledgeVersionStamp(
      itemModel as never,
      botOid,
      { includeNotesInKnowledge: true },
    );

    expect(stamp).toContain('kb:');
    expect(stamp).toContain(String(maxUpdated.getTime()));
    const pipeline = itemModel.aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
    const match = pipeline[0]?.$match as Record<string, unknown>;
    expect(match?.botId).toEqual(botOid);
    expect(JSON.stringify(match)).toContain('ready');
  });
});
