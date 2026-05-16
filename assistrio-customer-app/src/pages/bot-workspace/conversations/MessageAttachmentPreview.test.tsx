import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageAttachmentPreview } from './MessageAttachmentPreview';

describe('MessageAttachmentPreview', () => {
  it('renders filename and omits link for unsafe s3 url', () => {
    const html = renderToStaticMarkup(
      <MessageAttachmentPreview
        variant="user"
        attachments={[{ name: 'report.pdf', mimeType: 'application/pdf', url: 's3://bucket/key', size: 1200 }]}
      />,
    );
    expect(html).toContain('report.pdf');
    expect(html).toContain('PDF');
    expect(html).toContain('Secure link unavailable');
    expect(html).not.toMatch(/href="s3:/);
    expect(html).not.toContain('bucket');
  });

  it('renders https link when url is safe', () => {
    const html = renderToStaticMarkup(
      <MessageAttachmentPreview
        variant="user"
        attachments={[{ name: 'a.png', mimeType: 'image/png', url: 'https://cdn.example.com/a.png', size: 99 }]}
      />,
    );
    expect(html).toContain('href="https://cdn.example.com/a.png"');
    expect(html).toContain('Open / download');
  });
});
