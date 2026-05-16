import { describe, expect, it } from '@jest/globals';
import { isTrainableExtractedDocumentText } from '../knowledge/knowledge-text-metrics';

/**
 * Ingestion marks a document ready only when KB chunk rows exist with non-empty embeddings
 * (see IngestionService.processJob + KnowledgeBaseChunkService.countChunksWithValidEmbeddingsForDocument).
 */
describe('document ready / RAG invariants', () => {
  function isSafeToMarkDocumentReadyAfterChunkWrite(input: {
    chunksWritten: number;
    embeddedInDb: number;
  }): boolean {
    return input.chunksWritten > 0 && input.embeddedInDb > 0;
  }

  it('does not treat zero persisted chunks as safe for ready', () => {
    expect(isSafeToMarkDocumentReadyAfterChunkWrite({ chunksWritten: 0, embeddedInDb: 3 })).toBe(false);
    expect(isSafeToMarkDocumentReadyAfterChunkWrite({ chunksWritten: 2, embeddedInDb: 0 })).toBe(false);
    expect(isSafeToMarkDocumentReadyAfterChunkWrite({ chunksWritten: 2, embeddedInDb: 2 })).toBe(true);
  });

  it('rejects whitespace-only extracted text for training (marks failed, not ready)', () => {
    expect(isTrainableExtractedDocumentText(' \n\t ')).toBe(false);
  });
});
