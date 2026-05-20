import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantSourcesInlineList } from './AssistantSourcesInlineList';

function source(i: number) {
  return {
    chunkId: `c${i}`,
    sourceTitle: `Source title ${i}`,
    preview: `Preview ${i}`,
    score: 1 - i * 0.1,
  };
}

describe('AssistantSourcesInlineList', () => {
  it('shows up to three sources and View all sources when more exist', () => {
    const html = renderToStaticMarkup(
      <AssistantSourcesInlineList
        sources={[source(0), source(1), source(2), source(3)]}
        onViewAll={() => {}}
      />,
    );
    expect(html).toContain('Sources used');
    expect(html).toContain('Source title 0');
    expect(html).toContain('Source title 2');
    expect(html).not.toContain('Source title 3');
    expect(html).toContain('View all sources');
    expect(html).not.toContain('0.82');
  });

  it('does not show View all when three or fewer sources', () => {
    const html = renderToStaticMarkup(
      <AssistantSourcesInlineList sources={[source(0), source(1)]} onViewAll={() => {}} />,
    );
    expect(html).not.toContain('View all sources');
  });
});
