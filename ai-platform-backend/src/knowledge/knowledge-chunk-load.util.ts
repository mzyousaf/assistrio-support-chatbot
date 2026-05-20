import { Types } from 'mongoose';
import type { KnowledgeBaseChunk } from '../models/knowledge-base-chunk.schema';

export type ChunkRow = {
  _id: Types.ObjectId;
  knowledgeBaseItemId: Types.ObjectId;
  text: string;
  embedding: number[];
  chunkIndex: number;
  heading?: string;
};

/** Cap chunks per KB item and fair-merge across items (same semantics as aggregate path). */
export function mergeChunksFairRoundRobin(
  chunks: ChunkRow[],
  itemOrder: Types.ObjectId[],
  maxTotal: number,
): ChunkRow[] {
  const byItem = new Map<string, ChunkRow[]>();
  for (const id of itemOrder) {
    byItem.set(id.toString(), []);
  }
  for (const c of chunks) {
    const key = c.knowledgeBaseItemId.toString();
    const bucket = byItem.get(key);
    if (bucket) bucket.push(c);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }
  const out: ChunkRow[] = [];
  let round = 0;
  let progressed = true;
  while (out.length < maxTotal && progressed) {
    progressed = false;
    for (const id of itemOrder) {
      if (out.length >= maxTotal) break;
      const list = byItem.get(id.toString())!;
      if (round < list.length) {
        out.push(list[round]);
        progressed = true;
      }
    }
    round++;
  }
  return out;
}

/**
 * Load chunks with per-item cap in memory (avoids $setWindowFields for small KBs).
 */
export function loadChunksWithPerItemCap(
  rows: ChunkRow[],
  itemIdsStable: Types.ObjectId[],
  perItemCap: number,
  multiItemTotalCap: number,
): ChunkRow[] {
  const byItem = new Map<string, ChunkRow[]>();
  for (const id of itemIdsStable) {
    byItem.set(id.toString(), []);
  }
  for (const row of rows) {
    const key = row.knowledgeBaseItemId.toString();
    const list = byItem.get(key);
    if (list && list.length < perItemCap) {
      list.push(row);
    }
  }
  if (itemIdsStable.length <= 1) {
    const only = byItem.get(itemIdsStable[0]?.toString() ?? '') ?? [];
    return only;
  }
  const flat: ChunkRow[] = [];
  for (const list of byItem.values()) {
    flat.push(...list);
  }
  return mergeChunksFairRoundRobin(flat, itemIdsStable, multiItemTotalCap);
}

/**
 * Prefer find + in-memory per-item cap over $setWindowFields (often much faster for typical bot KBs).
 */
export function shouldUseSimpleChunkLoad(itemCount: number, perItemCap: number): boolean {
  if (itemCount <= 0) return false;
  if (itemCount <= 25) return true;
  return itemCount * perItemCap <= 2500;
}
