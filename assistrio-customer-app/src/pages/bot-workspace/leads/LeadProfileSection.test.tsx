import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadProfileSection } from './LeadProfileSection';

describe('LeadProfileSection', () => {
  it('renders removed/inactive section when defs include non-active keys', () => {
    const html = renderToStaticMarkup(
      <LeadProfileSection
        definitions={[
          { key: 'email', label: 'Email', type: 'email', required: false, order: 0 },
          {
            key: 'legacy_co',
            label: 'Legacy Co',
            type: 'text',
            required: false,
            order: 1,
            fieldStatus: 'deleted',
            archived: true,
            disabled: true,
            source: 'captured_data',
            enabled: false,
          },
        ]}
        capturedLeadData={{ email: 'a@b.co', legacy_co: 'Acme' }}
      />,
    );
    expect(html).toContain('Removed');
    expect(html).toContain('inactive fields');
    expect(html).toContain('Acme');
    expect(html).toContain('a@b.co');
  });
});
