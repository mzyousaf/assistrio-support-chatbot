import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssistantMessageFooter } from './AssistantMessageFooter';

describe('AssistantMessageFooter', () => {
  it('shows read-only liked icon when feedback rating is up', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter createdAt="2024-01-01T00:00:00.000Z" feedback={{ rating: 'up' }} />,
    );
    expect(html).toMatch(/aria-label="Liked"/);
  });

  it('shows Welcome chat tag and time in playground welcome mode', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter
        createdAt="2024-01-01T00:00:00.000Z"
        variant="playground"
        isWelcomeMessage
      />,
    );
    expect(html).toContain('Welcome chat');
    expect(html).not.toContain('Sources');
    expect(html).not.toContain('Review Answer');
  });

  it('shows Sources, Review Answer, and time pill for playground non-welcome messages', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter
        createdAt="2024-01-01T00:00:00.000Z"
        variant="playground"
        onOpenSources={() => {}}
        showRevise
        onReviseAnswer={() => {}}
      />,
    );
    expect(html).toContain('Sources');
    expect(html).toContain('Review Answer');
    expect(html).toMatch(/Jan 1, 2024/);
  });

  it('shows Review Answer and time in default mode', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter
        createdAt="2024-01-01T00:00:00.000Z"
        showRevise
        onReviseAnswer={() => {}}
      />,
    );
    expect(html).toContain('Review Answer');
  });

  it('shows read-only disliked icon when feedback rating is down', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter createdAt="2024-01-01T00:00:00.000Z" feedback={{ rating: 'down' }} />,
    );
    expect(html).toMatch(/aria-label="Disliked"/);
  });
});
