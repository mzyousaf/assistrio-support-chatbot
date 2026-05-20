import { Types } from 'mongoose';
import {
  loadChunksWithPerItemCap,
  mergeChunksFairRoundRobin,
  shouldUseSimpleChunkLoad,
} from './knowledge-chunk-load.util';

describe('knowledge-chunk-load.util', () => {
  it('shouldUseSimpleChunkLoad for typical multi-item KBs', () => {
    expect(shouldUseSimpleChunkLoad(2, 120)).toBe(true);
    expect(shouldUseSimpleChunkLoad(10, 120)).toBe(true);
    expect(shouldUseSimpleChunkLoad(6, 120)).toBe(true);
    expect(shouldUseSimpleChunkLoad(30, 120)).toBe(false);
  });

  it('caps chunks per item and fair-merges across items', () => {
    const itemA = new Types.ObjectId();
    const itemB = new Types.ObjectId();
    const rows = [
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemA, text: 'a0', embedding: [], chunkIndex: 0 },
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemA, text: 'a1', embedding: [], chunkIndex: 1 },
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemB, text: 'b0', embedding: [], chunkIndex: 0 },
    ];
    const merged = loadChunksWithPerItemCap(rows, [itemA, itemB], 1, 10);
    expect(merged.map((c) => c.text)).toEqual(['a0', 'b0']);
  });

  it('mergeChunksFairRoundRobin interleaves by item order', () => {
    const itemA = new Types.ObjectId();
    const itemB = new Types.ObjectId();
    const chunks = [
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemA, text: 'a0', embedding: [], chunkIndex: 0 },
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemA, text: 'a1', embedding: [], chunkIndex: 1 },
      { _id: new Types.ObjectId(), knowledgeBaseItemId: itemB, text: 'b0', embedding: [], chunkIndex: 0 },
    ];
    expect(mergeChunksFairRoundRobin(chunks, [itemA, itemB], 10).map((c) => c.text)).toEqual([
      'a0',
      'b0',
      'a1',
    ]);
  });
});
