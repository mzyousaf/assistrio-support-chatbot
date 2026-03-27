/**
 * Section-aware and FAQ-aware document chunking for better retrieval.
 * Smaller, sharper chunks (600–800 chars) with structure preservation: headings, FAQ pairs,
 * lists, policy/contact blocks. Compatible with documents and HTML-derived text.
 */

/** Target chunk size (retrieval-friendly; smaller than before for precision). */
const CHUNK_SIZE = 700;
/** Overlap between consecutive chunks for context continuity. */
const CHUNK_OVERLAP = 120;
const MIN_CHUNK_LENGTH = 80;
const MIN_TAIL_CHUNK_LENGTH = 25;
/** Minimum chars to keep for any tail (disclaimers, contact, deadlines). */
const ABSOLUTE_MIN_TAIL = 15;
const MAX_CHUNKS = 50;
/** When remaining chunk budget drops below this, limit subchunks per section so later sections get at least one chunk. */
const RESERVE_CHUNKS_FOR_LATER_SECTIONS = 5;

/** Markdown-style heading: # Title or ## Title */
const RE_MD_HEADING = /^#{1,6}\s+.+$/gm;
/** Numbered section at start of line: 1. Title, 2. Title, 10. Policy Updates */
const RE_NUMBERED_SECTION = /^\d+\.\s+.+$/gm;
/** FAQ question: Q:, Q., Q), Question:, Question -, etc. */
const RE_FAQ_QUESTION = /^(?:Q\.?|Q\)|Question)\s*[:\-\s)]*\s*/im;
/** FAQ answer: A:, A., A), Answer:, Answer -, etc. */
const RE_FAQ_ANSWER = /^(?:A\.?|A\)|Answer)\s*[:\-\s)]*\s*/im;
/** Standardized FAQ chunk format: [Section]\nQ: ...\nA: ... (or Q: only for orphan). Used to detect FAQ chunks in retrieval/debug. */
const RE_FAQ_CHUNK_Q = /^\[[^\]]+\]\s*\n\s*Q:\s+/m;
const RE_FAQ_CHUNK_A = /\n\s*A:\s+/m;
/** Extract [Section] from chunk text for metadata. */
const RE_SECTION_BRACKET = /^\[([^\]]+)\]\s*\n?/;

/** Optional metadata for a chunk (section, index, source). Compatible with ingestion when only .text is used. */
export interface ChunkWithMetadata {
  text: string;
  metadata?: {
    sectionTitle?: string;
    chunkIndex: number;
    totalChunks: number;
    sourceTitle?: string;
    sourceType?: string;
  };
}

/**
 * Normalize whitespace for chunking without flattening structure.
 * Preserves paragraph breaks (\n\n), list line breaks, and FAQ formatting.
 */
function normalizeForChunking(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Find heading-like positions in text. Returns array of { index, title } for each match.
 * Tries markdown #, then numbered "1. ", "2. ", etc.
 */
function findHeadings(text: string): Array<{ index: number; title: string }> {
  const results: Array<{ index: number; title: string }> = [];
  let lastIndex = 0;

  // Markdown headings
  const byMd = [...text.matchAll(RE_MD_HEADING)];
  for (const m of byMd) {
    if (m.index != null) {
      const title = (m[0] || '').replace(/^#+\s*/, '').trim();
      if (title.length > 0) results.push({ index: m.index, title });
    }
  }

  // Numbered sections (e.g. "1. Overview", "9. Contact Support")
  const byNum = [...text.matchAll(RE_NUMBERED_SECTION)];
  for (const m of byNum) {
    if (m.index != null) {
      const fullLine = (m[0] || '').trim();
      if (fullLine.length >= 3 && fullLine.length < 150) results.push({ index: m.index, title: fullLine });
    }
  }

  results.sort((a, b) => a.index - b.index);
  // Dedupe by index (same position might match both patterns)
  const seen = new Set<number>();
  return results.filter((r) => {
    if (seen.has(r.index)) return false;
    seen.add(r.index);
    return true;
  });
}

/**
 * Split text into FAQ-style Q/A pairs (and orphan questions). Each block is one retrievable unit.
 * Returns array of { text, startIdx, endIdx } for reliable section splitting.
 * Orphan Q (no A before next Q) is still emitted so the question is retrievable.
 */
function extractFaqBlocks(sectionText: string): Array<{ text: string; startIdx: number; endIdx: number }> {
  const blocks: Array<{ text: string; startIdx: number; endIdx: number }> = [];
  const lines = sectionText.split(/\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (RE_FAQ_QUESTION.test(line)) {
      const qStartLine = i;
      let aIndex = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (RE_FAQ_ANSWER.test(lines[j])) {
          aIndex = j;
          break;
        }
        if (RE_FAQ_QUESTION.test(lines[j])) break;
      }
      if (aIndex >= 0) {
        let answerEnd = aIndex + 1;
        while (answerEnd < lines.length && !RE_FAQ_QUESTION.test(lines[answerEnd])) {
          if (lines[answerEnd].trim() === '' && answerEnd + 1 < lines.length && RE_FAQ_QUESTION.test(lines[answerEnd + 1])) break;
          answerEnd++;
        }
        const blockLines = lines.slice(qStartLine, answerEnd);
        const text = blockLines.join('\n').trim();
        const startIdx = lines.slice(0, qStartLine).join('\n').length;
        const endIdx = lines.slice(0, answerEnd).join('\n').length;
        if (text.length >= ABSOLUTE_MIN_TAIL) blocks.push({ text, startIdx, endIdx });
        i = answerEnd;
        continue;
      }
      // Orphan Q: no A found before next Q; emit question as its own chunk so it's retrievable.
      let orphanEnd = i + 1;
      while (orphanEnd < lines.length && !RE_FAQ_QUESTION.test(lines[orphanEnd]) && !RE_FAQ_ANSWER.test(lines[orphanEnd])) {
        orphanEnd++;
      }
      const orphanLines = lines.slice(qStartLine, orphanEnd);
      const orphanText = orphanLines.join('\n').trim();
      if (orphanText.length >= ABSOLUTE_MIN_TAIL) {
        const oStart = lines.slice(0, qStartLine).join('\n').length;
        const oEnd = lines.slice(0, orphanEnd).join('\n').length;
        blocks.push({ text: orphanText, startIdx: oStart, endIdx: oEnd });
      }
      i = orphanEnd;
      continue;
    }
    i++;
  }
  return blocks;
}

/**
 * Format a raw FAQ block into a consistent, retrieval-friendly chunk string.
 * Output: [Section Title]\nQ: <question>\nA: <answer> (or Q: only for orphan).
 * Makes FAQ chunks distinguishable and prompt-friendly.
 */
function formatFaqBlockForChunk(sectionTitle: string, rawBlockText: string): string {
  const lines = rawBlockText.trim().split('\n');
  let qIdx = -1;
  let aIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (RE_FAQ_QUESTION.test(lines[i])) {
      qIdx = i;
      break;
    }
  }
  if (qIdx < 0) return `[${sectionTitle}]\n${rawBlockText.trim()}`;

  for (let i = qIdx + 1; i < lines.length; i++) {
    if (RE_FAQ_ANSWER.test(lines[i])) {
      aIdx = i;
      break;
    }
  }
  const questionLines = aIdx >= 0 ? lines.slice(qIdx, aIdx) : lines.slice(qIdx);
  const answerLines = aIdx >= 0 ? lines.slice(aIdx) : [];
  const questionText = questionLines
    .map((line, idx) => (idx === 0 ? line.replace(RE_FAQ_QUESTION, '').trim() : line.trim()))
    .join('\n')
    .trim();
  const answerText = answerLines
    .map((line, idx) => (idx === 0 ? line.replace(RE_FAQ_ANSWER, '').trim() : line.trim()))
    .join('\n')
    .trim();
  const prefix = `[${sectionTitle}]\n`;
  if (!answerText) return `${prefix}Q: ${questionText}`;
  return `${prefix}Q: ${questionText}\nA: ${answerText}`;
}

/**
 * Infer chunk kind from chunk text (no schema change). Used for retrieval/debug visibility.
 * FAQ chunks: new format [Section]\nQ: ...\nA: ... or legacy Question:/Answer: style after [Section].
 */
export function inferChunkKind(chunkText: string): 'faq' | 'section' {
  if (!chunkText || typeof chunkText !== 'string') return 'section';
  const t = chunkText.trim();
  if (!t.startsWith('[')) return 'section';
  if (RE_FAQ_CHUNK_Q.test(t)) return 'faq';
  const afterBracket = t.slice(t.indexOf(']') + 1).trim();
  if (RE_FAQ_QUESTION.test(afterBracket) && (RE_FAQ_ANSWER.test(afterBracket) || /\n\s*A[\.\):\s]/i.test(afterBracket))) return 'faq';
  return 'section';
}

/** Regex: line that starts a list item (bullet or numbered). */
const RE_LIST_LINE = /^\s*(\d+[.)]\s+|[*-]\s+)/m;

/**
 * Find a good break point in body before (startIdx + maxLen).
 * Prefers paragraph (\n\n), then line (\n), and avoids splitting in the middle of list items.
 */
function findBreakPoint(body: string, startIdx: number, maxLen: number): number {
  const end = Math.min(startIdx + maxLen, body.length);
  let candidate = end;
  const segment = body.slice(startIdx, end);
  const lastDouble = segment.lastIndexOf('\n\n');
  const lastSingle = segment.lastIndexOf('\n');
  if (lastDouble >= MIN_CHUNK_LENGTH - 1) {
    candidate = startIdx + lastDouble + 1;
  } else if (lastSingle >= MIN_CHUNK_LENGTH - 1) {
    candidate = startIdx + lastSingle + 1;
  }
  const beforeBreak = body.slice(startIdx, candidate).trimEnd();
  const rawAfter = body.slice(candidate);
  const afterBreak = rawAfter.trimStart();
  if (afterBreak.length > 0 && RE_LIST_LINE.test(afterBreak)) {
    const lineEnd = afterBreak.indexOf('\n');
    const endOfFirstLine = lineEnd >= 0 ? lineEnd : afterBreak.length;
    const firstLine = afterBreak.slice(0, endOfFirstLine);
    if (firstLine.trim().length > 0 && beforeBreak.length + firstLine.length <= CHUNK_SIZE) {
      const trimOffset = rawAfter.length - afterBreak.length;
      candidate = candidate + trimOffset + endOfFirstLine + (lineEnd >= 0 ? 1 : 0);
    }
  }
  return Math.min(candidate, body.length);
}

/**
 * Split a section into subchunks with overlap, breaking at paragraph/line boundaries.
 * Preserves short tails (disclaimers, contact, deadlines). Every subchunk gets the section title.
 * @param maxChunks - When set, cap subchunks so later sections get at least one chunk.
 */
function splitLargeSection(
  sectionTitle: string,
  body: string,
  options?: { maxChunks?: number },
): string[] {
  const prefix = sectionTitle ? `[${sectionTitle}]\n` : '';
  const chunks: string[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;
  let cursor = 0;
  const maxChunksFromSection = options?.maxChunks ?? 15;
  while (cursor < body.length && chunks.length < maxChunksFromSection) {
    const breakAt = findBreakPoint(body, cursor, CHUNK_SIZE);
    const slice = body.slice(cursor, breakAt).trim();
    if (slice.length >= MIN_CHUNK_LENGTH) {
      chunks.push(prefix + slice);
      cursor = body.length <= breakAt ? body.length : Math.max(cursor + 1, breakAt - CHUNK_OVERLAP);
    } else if (slice.length >= MIN_TAIL_CHUNK_LENGTH) {
      chunks.push(prefix + slice);
      cursor = body.length;
      break;
    } else {
      cursor = breakAt > cursor ? breakAt : cursor + step;
    }
  }
  const remainder = body.slice(cursor).trim();
  if (remainder.length >= ABSOLUTE_MIN_TAIL) {
    chunks.push(prefix + remainder);
  }
  return chunks;
}

/**
 * Section-aware chunking: split by headings, preserve heading in chunk text, handle FAQ blocks, protect tail.
 * Reserves chunk budget for later sections so end-of-doc sections (contact, disclaimers) are not starved.
 */
export function chunkTextSectionAware(text: string): string[] {
  const normalized = normalizeForChunking(text);
  if (!normalized) return [];

  const headings = findHeadings(normalized);
  const chunks: string[] = [];

  if (headings.length === 0) {
    return chunkTextFallback(normalized);
  }

  const firstHeadingIdx = headings[0].index;
  const intro = normalized.slice(0, firstHeadingIdx).trim();
  const sectionsCount = headings.length + (intro.length >= MIN_TAIL_CHUNK_LENGTH ? 1 : 0);
  const remainingAfterIntro = () => Math.max(0, MAX_CHUNKS - chunks.length);
  const reserveForLater = () => Math.max(0, remainingAfterIntro() - RESERVE_CHUNKS_FOR_LATER_SECTIONS);
  const maxChunksForIntro = sectionsCount > 1 ? Math.min(15, reserveForLater()) : undefined;

  if (intro.length >= MIN_TAIL_CHUNK_LENGTH && chunks.length < MAX_CHUNKS) {
    if (intro.length <= CHUNK_SIZE) {
      chunks.push('[Introduction]\n' + intro);
    } else {
      chunks.push(...splitLargeSection('Introduction', intro, maxChunksForIntro != null ? { maxChunks: maxChunksForIntro } : undefined));
    }
  }

  for (let i = 0; i < headings.length && chunks.length < MAX_CHUNKS; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : normalized.length;
    const sectionTitle = headings[i].title;
    const sectionText = normalized.slice(start, end).trim();
    if (!sectionText) continue;

    const remaining = remainingAfterIntro();
    const sectionsLeft = headings.length - i;
    const sectionChunkCap =
      remaining <= RESERVE_CHUNKS_FOR_LATER_SECTIONS && sectionsLeft >= 1
        ? Math.max(1, Math.floor(remaining / sectionsLeft))
        : undefined;
    let chunksUsedThisSection = 0;
    const maxChunksForPart = () =>
      sectionChunkCap != null ? Math.max(0, sectionChunkCap - chunksUsedThisSection) : undefined;

    const faqBlocks = extractFaqBlocks(sectionText);
    if (faqBlocks.length > 0) {
      const nonFaqParts = splitByFaqBlocks(sectionText, faqBlocks);
      for (const part of nonFaqParts.beforeFaq) {
        if (part.length >= MIN_TAIL_CHUNK_LENGTH && chunks.length < MAX_CHUNKS) {
          const withTitle = `[${sectionTitle}]\n${part}`;
          if (withTitle.length <= CHUNK_SIZE) {
            chunks.push(withTitle);
            chunksUsedThisSection++;
          } else {
            const opts = maxChunksForPart() != null ? { maxChunks: maxChunksForPart()! } : undefined;
            const added = splitLargeSection(sectionTitle, part, opts);
            chunks.push(...added);
            chunksUsedThisSection += added.length;
          }
        }
      }
      for (const faq of faqBlocks) {
        if (chunks.length >= MAX_CHUNKS || (sectionChunkCap != null && chunksUsedThisSection >= sectionChunkCap)) break;
        if (faq.text.length < ABSOLUTE_MIN_TAIL) continue;
        const faqFormatted = formatFaqBlockForChunk(sectionTitle, faq.text);
        if (faqFormatted.length <= CHUNK_SIZE) {
          chunks.push(faqFormatted);
          chunksUsedThisSection++;
        } else {
          const opts = maxChunksForPart() != null ? { maxChunks: maxChunksForPart()! } : undefined;
          const sectionPrefix = `[${sectionTitle}]\n`;
          const bodyOnly = faqFormatted.startsWith(sectionPrefix) ? faqFormatted.slice(sectionPrefix.length) : faqFormatted;
          const added = splitLargeSection(sectionTitle, bodyOnly, opts);
          chunks.push(...added);
          chunksUsedThisSection += added.length;
        }
      }
      for (const part of nonFaqParts.afterFaq) {
        if (part.length >= MIN_TAIL_CHUNK_LENGTH && chunks.length < MAX_CHUNKS && (sectionChunkCap == null || chunksUsedThisSection < sectionChunkCap)) {
          const withTitle = `[${sectionTitle}]\n${part}`;
          if (withTitle.length <= CHUNK_SIZE) {
            chunks.push(withTitle);
            chunksUsedThisSection++;
          } else {
            const opts = maxChunksForPart() != null ? { maxChunks: maxChunksForPart()! } : undefined;
            const added = splitLargeSection(sectionTitle, part, opts);
            chunks.push(...added);
            chunksUsedThisSection += added.length;
          }
        }
      }
    } else {
      if (sectionText.length <= CHUNK_SIZE && sectionText.length >= MIN_CHUNK_LENGTH) {
        chunks.push(`[${sectionTitle}]\n${sectionText}`);
      } else if (sectionText.length >= MIN_TAIL_CHUNK_LENGTH) {
        const opts = maxChunksForPart() != null ? { maxChunks: maxChunksForPart()! } : undefined;
        const added = splitLargeSection(sectionTitle, sectionText, opts);
        chunks.push(...added);
      } else if (sectionText.length >= ABSOLUTE_MIN_TAIL) {
        chunks.push(`[${sectionTitle}]\n${sectionText}`);
      }
    }
  }

  return chunks.slice(0, MAX_CHUNKS);
}

function splitByFaqBlocks(
  sectionText: string,
  faqBlocks: Array<{ text: string; startIdx: number; endIdx: number }>,
): { beforeFaq: string[]; afterFaq: string[] } {
  const first = faqBlocks[0];
  const last = faqBlocks[faqBlocks.length - 1];
  const beforeFaq = first ? sectionText.slice(0, first.startIdx).trim() : '';
  const afterFaq = last ? sectionText.slice(last.endIdx).trim() : '';
  return {
    beforeFaq: beforeFaq ? [beforeFaq] : [],
    afterFaq: afterFaq ? [afterFaq] : [],
  };
}

/**
 * Fallback: fixed-size sliding window (original behavior) but never drop short tail.
 */
export function chunkTextFallback(text: string): string[] {
  const normalized = normalizeForChunking(text);
  if (!normalized) return [];

  const chunks: string[] = [];
  const step = CHUNK_SIZE - CHUNK_OVERLAP;
  let cursor = 0;

  while (cursor < normalized.length && chunks.length < MAX_CHUNKS) {
    const candidate = normalized.slice(cursor, cursor + CHUNK_SIZE).trim();
    if (candidate.length >= MIN_CHUNK_LENGTH) {
      chunks.push(candidate);
    }
    cursor += step;
  }

  const remainder = normalized.slice(cursor).trim();
  if (remainder.length >= ABSOLUTE_MIN_TAIL && chunks.length < MAX_CHUNKS) {
    chunks.push(remainder);
  }

  return chunks;
}

/**
 * Main entry: try section-aware first; if it produces no chunks (e.g. no headings), use fallback.
 * Returns plain string[] for backward compatibility with ingestion (only .text is stored).
 */
export function chunkDocumentText(text: string): string[] {
  const sectionChunks = chunkTextSectionAware(text);
  if (sectionChunks.length > 0) return sectionChunks;
  return chunkTextFallback(text);
}

/** Options for chunking when source context (e.g. document or HTML page) is known. */
export interface ChunkDocumentOptions {
  sourceTitle?: string;
  sourceType?: string;
}

function extractSectionFromChunkText(chunkText: string): string | undefined {
  const m = chunkText.trim().match(RE_SECTION_BRACKET);
  return m ? m[1].trim() : undefined;
}

/**
 * Chunk document or HTML-derived text and return items with optional metadata.
 * Use for unified retrieval; ingestion can use chunkDocumentText(text) and pass .map(c => c.text) for storage.
 */
export function chunkDocumentTextWithMetadata(
  text: string,
  options?: ChunkDocumentOptions,
): ChunkWithMetadata[] {
  const strings = chunkDocumentText(text);
  return strings.map((chunkText, i) => ({
    text: chunkText,
    metadata: {
      sectionTitle: extractSectionFromChunkText(chunkText),
      chunkIndex: i,
      totalChunks: strings.length,
      ...(options?.sourceTitle != null && { sourceTitle: options.sourceTitle }),
      ...(options?.sourceType != null && { sourceType: options.sourceType }),
    },
  }));
}
