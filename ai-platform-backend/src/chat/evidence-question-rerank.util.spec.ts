import { rerankEvidenceForQuestion } from './evidence-question-rerank.util';
import type { RankedKnowledgeItem } from '../rag/unified-retrieval.types';

function item(id: string, title: string, score: number): RankedKnowledgeItem {
  return {
    id,
    botId: 'b',
    sourceType: 'document',
    sourceId: id,
    title,
    text: title,
    normalizedText: title,
    active: true,
    status: 'ready',
    semanticScore: score,
    lexicalScore: score,
    combinedScore: score,
  };
}

describe('rerankEvidenceForQuestion', () => {
  const overviewQ = 'Explain what Assistrio does and include its main features.';

  it('prioritizes product overview chunks over headquarters for overview questions', () => {
    const ranked = [
      item('hq', 'Headquarters Location', 0.45),
      item('team', 'Our Team', 0.42),
      item('intro', 'Introduction to Assistrio Products', 0.38),
      item('value', 'Key Value Proposition', 0.36),
    ];
    const out = rerankEvidenceForQuestion(ranked, overviewQ, 'company_factual');
    expect(out[0]?.title).toMatch(/Introduction|Value Proposition/i);
    expect(out.slice(0, 2).some((i) => /Headquarters|Team/i.test(i.title))).toBe(false);
  });

  it('leaves order unchanged for non-overview questions', () => {
    const ranked = [
      item('hq', 'Headquarters Location', 0.45),
      item('intro', 'Introduction to Assistrio Products', 0.38),
    ];
    const out = rerankEvidenceForQuestion(ranked, 'What is your refund policy?', 'company_factual');
    expect(out[0]?.id).toBe('hq');
  });
});
