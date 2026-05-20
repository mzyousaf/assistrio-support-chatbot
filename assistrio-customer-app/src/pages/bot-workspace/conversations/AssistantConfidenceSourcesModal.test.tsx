import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantSourcesUsedList } from './AssistantConfidenceSourcesModal';

const sampleSources = [
  {
    chunkId: 'c1',
    sourceTitle: 'Pricing FAQ',
    preview: 'Refund policy details…',
    sourceType: 'faq',
    score: 0.82,
  },
  {
    chunkId: 'c2',
    docTitle: 'Company overview',
    preview: 'Assistrio provides…',
    sourceType: 'document',
    score: 0.41,
  },
];

describe('AssistantSourcesUsedList', () => {
  it('lists sources without confidence/score/type UI', () => {
    const html = renderToStaticMarkup(<AssistantSourcesUsedList sources={sampleSources} />);
    expect(html).toContain('Source 1');
    expect(html).toContain('Pricing FAQ');
    expect(html).toContain('Source 2');
    expect(html).not.toContain('DOCUMENT');
    expect(html).not.toContain('0.82');
    expect(html).not.toContain('0.41');
    expect(html).not.toMatch(/confidence/i);
  });
});
