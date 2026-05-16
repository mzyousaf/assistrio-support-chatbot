import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageFeedbackStatus } from './MessageFeedbackStatus';

describe('MessageFeedbackStatus', () => {
  it('renders thumbs up when rating is up', () => {
    const html = renderToStaticMarkup(<MessageFeedbackStatus feedback={{ rating: 'up' }} />);
    expect(html).toMatch(/aria-label="Liked"/);
    expect(html).toMatch(/title="Liked"/);
  });

  it('renders thumbs down when rating is down', () => {
    const html = renderToStaticMarkup(<MessageFeedbackStatus feedback={{ rating: 'down' }} />);
    expect(html).toMatch(/aria-label="Disliked"/);
    expect(html).toMatch(/title="Disliked"/);
  });

  it('renders nothing when feedback is missing', () => {
    expect(renderToStaticMarkup(<MessageFeedbackStatus />)).toBe('');
    expect(renderToStaticMarkup(<MessageFeedbackStatus feedback={null} />)).toBe('');
  });

  it('renders nothing when rating is invalid', () => {
    expect(renderToStaticMarkup(<MessageFeedbackStatus feedback={{ rating: 'maybe' as never }} />)).toBe('');
  });
});
