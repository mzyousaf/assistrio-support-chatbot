import {
  listKnowledgeDocumentAssetsFromDraft,
  parseTrialOnboardingFaqsForKnowledgeBase,
} from './trial-onboarding-knowledge-bootstrap.util';

describe('trial-onboarding-knowledge-bootstrap.util', () => {
  it('lists knowledge_document assets only', () => {
    const assets = listKnowledgeDocumentAssetsFromDraft([
      { kind: 'avatar', assetKey: 'a', originalFilename: 'x.png', mimeType: 'image/png', sizeBytes: 1, uploadedAt: new Date() },
      {
        kind: 'knowledge_document',
        assetKey: 'trial/k.pdf',
        originalFilename: 'Guide.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        uploadedAt: new Date(),
      },
    ]);
    expect(assets).toEqual([
      {
        assetKey: 'trial/k.pdf',
        originalFilename: 'Guide.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
      },
    ]);
  });

  it('parses FAQs requiring both Q and A', () => {
    expect(
      parseTrialOnboardingFaqsForKnowledgeBase([
        { id: '1', question: 'A?', answer: 'B' },
        { id: '2', question: '', answer: 'only answer' },
        { id: '3', question: 'Q', answer: '' },
      ]),
    ).toEqual([{ question: 'A?', answer: 'B', active: true }]);
  });
});
