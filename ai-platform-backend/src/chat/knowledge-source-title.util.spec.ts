import { resolveKnowledgeSourceTitle } from './knowledge-source-title.util';

describe('resolveKnowledgeSourceTitle', () => {
  it('prefers knowledge base item title when present', () => {
    expect(
      resolveKnowledgeSourceTitle({
        title: 'Introduction to Assistrio Products',
        section: 'Overview',
        text: '[1. Other]\nBody',
      }),
    ).toBe('Introduction to Assistrio Products');
  });

  it('uses section when title is Untitled', () => {
    expect(
      resolveKnowledgeSourceTitle({
        title: 'Untitled',
        section: 'Assistrio Company Information',
        text: 'Body text',
      }),
    ).toBe('Assistrio Company Information');
  });

  it('extracts bracket heading from chunk text when title and section missing', () => {
    expect(
      resolveKnowledgeSourceTitle({
        title: 'Untitled',
        section: '',
        text: '[1. Introduction to Assistrio Products]\nAssistrio builds AI support tools.',
      }),
    ).toBe('Introduction to Assistrio Products');
  });

  it('falls back to Knowledge source when nothing else resolves', () => {
    expect(
      resolveKnowledgeSourceTitle({
        title: 'Untitled',
        text: 'Plain paragraph without a heading marker.',
      }),
    ).toBe('Knowledge source');
  });
});
