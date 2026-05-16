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

  it('shows read-only disliked icon when feedback rating is down', () => {
    const html = renderToStaticMarkup(
      <AssistantMessageFooter createdAt="2024-01-01T00:00:00.000Z" feedback={{ rating: 'down' }} />,
    );
    expect(html).toMatch(/aria-label="Disliked"/);
  });
});
