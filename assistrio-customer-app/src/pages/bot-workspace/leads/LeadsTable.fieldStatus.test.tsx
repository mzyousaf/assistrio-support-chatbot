import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadsTable } from './LeadsTable';

describe('LeadsTable historical column badges', () => {
  it('renders Inactive vs Deleted badges from field status', () => {
    const html = renderToStaticMarkup(
      <LeadsTable
        botId="bot1"
        leads={[]}
        columnDefs={[
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
          {
            key: 'budget',
            label: 'Budget',
            type: 'text',
            required: false,
            order: 2,
            fieldStatus: 'inactive',
            archived: true,
            disabled: true,
            source: 'current',
            enabled: false,
          },
        ]}
        onOpenDetail={() => {}}
        onOpenChat={() => {}}
      />,
    );
    expect(html).toContain('Inactive');
    expect(html).toContain('Deleted');
    expect(html.toLowerCase()).not.toContain('archived');
  });
});
