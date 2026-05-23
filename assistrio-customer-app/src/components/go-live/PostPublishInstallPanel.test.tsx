import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { PostPublishInstallPanel } from './PostPublishInstallPanel';

describe('PostPublishInstallPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows Chat widget snippet by default and switches to Iframe tab', () => {
    render(
      <PostPublishInstallPanel
        allowedOrigins={['https://www.example.com']}
        widgetSnippet="<script>widget</script>"
        iframeSnippet='<iframe src="https://app/iframe/bot"></iframe>'
      />,
    );

    expect(document.body.textContent).toContain('<script>widget</script>');
    expect(document.body.textContent).not.toContain('iframe/bot');

    fireEvent.click(screen.getByRole('tab', { name: 'Iframe' }));

    expect(document.body.textContent).toContain('iframe/bot');
    expect(document.body.textContent).not.toContain('<script>widget</script>');
  });
});
