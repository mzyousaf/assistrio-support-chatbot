import { HttpException } from '@nestjs/common';
import {
  mergeQaImportRows,
  parseQaImportSpreadsheet,
} from './workspace-onboarding-qa-import.util';
import {
  ONBOARDING_KNOWLEDGE_QA_MAX,
  ONBOARDING_QA_IMPORT_SKIPPED_REASON,
} from './workspace-onboarding-knowledge-limits.constants';

describe('workspace onboarding Q&A import', () => {
  it('parses CSV with title, questions, answer columns', () => {
    const csv = Buffer.from(
      'title,questions,answer\nShipping,When do you ship?|How long?,We ship in 1-2 days.\n',
      'utf8',
    );
    const { rows, errors } = parseQaImportSpreadsheet(csv, 'qa.csv');
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Shipping');
    expect(rows[0]?.questions).toEqual(['When do you ship?', 'How long?']);
  });

  it('parses legacy sample rows that use the question column beside an empty questions column', () => {
    const csv = Buffer.from(
      [
        'title,question,questions,answer',
        'Shipping,When do you ship orders?,,We ship within 1-2 business days.',
        'Returns,,How do I return an item?|What is your return policy?,You can return unused items within 30 days.',
        'Pricing,Do you offer discounts?,,We run seasonal promotions.',
      ].join('\n'),
      'utf8',
    );
    const { rows, errors } = parseQaImportSpreadsheet(csv, 'qa.csv');
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.questions).toEqual(['When do you ship orders?']);
    expect(rows[1]?.questions).toEqual(['How do I return an item?', 'What is your return policy?']);
  });

  it('uses the first question as title when title cell is empty', () => {
    const csv = Buffer.from(
      'title,questions,answer\n,When do you ship?,We ship in 1-2 days.\n',
      'utf8',
    );
    const { rows, errors } = parseQaImportSpreadsheet(csv, 'qa.csv');
    expect(errors).toHaveLength(0);
    expect(rows[0]?.title).toBe('When do you ship?');
  });

  it('imports only until onboarding max of 20 Q&A items', () => {
    const existing = Array.from({ length: 18 }, (_, i) => ({
      id: String(i),
      title: `Q${i}`,
      questions: ['?'],
      answer: 'A',
      createdAt: null,
      updatedAt: null,
    }));
    const incoming = Array.from({ length: 5 }, (_, i) => ({
      title: `New ${i}`,
      questions: ['?'],
      answer: 'a',
    }));
    const { merged, imported, skippedCount, skippedReason } = mergeQaImportRows(existing, incoming);
    expect(imported).toBe(2);
    expect(skippedCount).toBe(3);
    expect(skippedReason).toBe(ONBOARDING_QA_IMPORT_SKIPPED_REASON);
    expect(merged).toHaveLength(ONBOARDING_KNOWLEDGE_QA_MAX);
  });

  it('allows import up to max when slots remain', () => {
    const existing = Array.from({ length: ONBOARDING_KNOWLEDGE_QA_MAX - 1 }, (_, i) => ({
      id: String(i),
      title: `Q${i}`,
      questions: ['?'],
      answer: 'A',
      createdAt: null,
      updatedAt: null,
    }));
    const { merged, imported, skippedCount } = mergeQaImportRows(existing, [
      { title: 'New', questions: ['?'], answer: 'yes' },
    ]);
    expect(imported).toBe(1);
    expect(skippedCount).toBe(0);
    expect(merged).toHaveLength(ONBOARDING_KNOWLEDGE_QA_MAX);
  });
});
