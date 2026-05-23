import { normalizeOnboardingKnowledge, hasOnboardingTextKnowledge } from './workspace-onboarding-knowledge-normalize.util';

describe('normalizeOnboardingKnowledge', () => {
  it('maps legacy knowledgeDescription to default snippet', () => {
    const normalized = normalizeOnboardingKnowledge({
      knowledgeDescription: 'Legacy note body',
      faqs: [],
      snippets: [],
      qas: [],
    });
    expect(normalized.snippets).toHaveLength(1);
    expect(normalized.snippets[0]?.title).toBe('General information');
    expect(normalized.snippets[0]?.description).toBe('Legacy note body');
    expect(normalized.snippets[0]?.id).toBe('legacy:knowledge-description');
    expect(hasOnboardingTextKnowledge(normalized)).toBe(true);
  });

  it('maps legacy faq rows to qas with questions array', () => {
    const normalized = normalizeOnboardingKnowledge({
      knowledgeDescription: '',
      faqs: [{ question: 'What are your hours?', answer: '9-5 weekdays' }],
      snippets: [],
      qas: [],
    });
    expect(normalized.qas).toHaveLength(1);
    expect(normalized.qas[0]?.questions).toEqual(['What are your hours?']);
    expect(normalized.qas[0]?.answer).toBe('9-5 weekdays');
    expect(normalized.qas[0]?.id).toBe('legacy:faq:0');
  });

  it('prefers explicit snippets and qas over legacy fields', () => {
    const normalized = normalizeOnboardingKnowledge({
      knowledgeDescription: 'old',
      faqs: [{ question: 'old?', answer: 'old' }],
      snippets: [{ id: 's1', title: 'Pricing', description: 'Plans start at $9', createdAt: undefined, updatedAt: undefined }],
      qas: [
        {
          id: 'q1',
          title: 'Support',
          questions: ['How do I contact support?'],
          answer: 'Email us',
          createdAt: undefined,
          updatedAt: undefined,
        },
      ],
    });
    expect(normalized.snippets).toHaveLength(1);
    expect(normalized.snippets[0]?.title).toBe('Pricing');
    expect(normalized.qas).toHaveLength(1);
    expect(normalized.qas[0]?.title).toBe('Support');
  });

  it('preserves ISO string timestamps from serialized draft knowledge', () => {
    const normalized = normalizeOnboardingKnowledge({
      knowledgeDescription: '',
      faqs: [],
      snippets: [
        {
          id: 's1',
          title: 'A',
          description: 'Body A',
          createdAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
          updatedAt: '2024-01-01T00:00:00.000Z' as unknown as Date,
        },
        {
          id: 's2',
          title: 'B',
          description: 'Body B',
          createdAt: '2024-01-03T00:00:00.000Z' as unknown as Date,
          updatedAt: '2024-01-03T00:00:00.000Z' as unknown as Date,
        },
      ],
      qas: [
        {
          id: 'q1',
          title: 'Q1',
          questions: ['?'],
          answer: 'A1',
          createdAt: '2024-01-02T00:00:00.000Z' as unknown as Date,
          updatedAt: '2024-01-02T00:00:00.000Z' as unknown as Date,
        },
      ],
    });

    expect(normalized.snippets[0]?.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(normalized.snippets[1]?.updatedAt).toBe('2024-01-03T00:00:00.000Z');
    expect(normalized.qas[0]?.createdAt).toBe('2024-01-02T00:00:00.000Z');
  });
});
