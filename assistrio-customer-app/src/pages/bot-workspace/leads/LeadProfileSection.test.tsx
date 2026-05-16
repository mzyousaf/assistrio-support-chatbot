import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadProfileSection } from './LeadProfileSection';

describe('LeadProfileSection', () => {
  it('lists active and historical fields in one section with a Deleted tag for removed defs', () => {
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
    expect(html).toContain('Captured fields');
    expect(html).toContain('Deleted');
    expect(html).not.toContain('Removed');
    expect(html).not.toContain('inactive fields');
    expect(html).toContain('Acme');
    expect(html).toContain('a@b.co');
  });

  it('shows Inactive tag for inactive field definitions', () => {
    const html = renderToStaticMarkup(
      <LeadProfileSection
        definitions={[
          {
            key: 'budget',
            label: 'Budget',
            type: 'text',
            required: false,
            order: 0,
            fieldStatus: 'inactive',
            archived: true,
            disabled: true,
            source: 'current',
            enabled: false,
          },
        ]}
        capturedLeadData={{ budget: '100' }}
      />,
    );
    expect(html).toContain('Inactive');
    expect(html).toContain('100');
  });
});
