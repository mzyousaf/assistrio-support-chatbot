import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadsTable } from './LeadsTable';

const inboxColumns = [
  { headerLabel: 'Name', field: { key: 'name', label: 'Name', type: 'text', required: false, order: 0 } },
  { headerLabel: 'Email', field: { key: 'email', label: 'Email', type: 'email', required: false, order: 1 } },
  {
    headerLabel: 'Phone',
    field: {
      key: 'budget',
      label: 'Budget',
      type: 'text',
      required: false,
      order: 2,
      fieldStatus: 'inactive' as const,
      archived: true,
      disabled: true,
      source: 'current',
      enabled: false,
    },
  },
  {
    headerLabel: 'Company',
    field: {
      key: 'legacy_co',
      label: 'Legacy Co',
      type: 'text',
      required: false,
      order: 3,
      fieldStatus: 'deleted' as const,
      archived: true,
      disabled: true,
      source: 'captured_data',
      enabled: false,
    },
  },
] as const;

const notesField: CustomerLeadFieldDefinition = {
  key: 'notes',
  label: 'Notes',
  type: 'text',
  required: false,
  order: 4,
  fieldStatus: 'inactive',
  archived: true,
  disabled: true,
  source: 'current',
  enabled: false,
};

const leadFieldDefinitions: CustomerLeadFieldDefinition[] = [...inboxColumns.map((c) => c.field), notesField];

const sampleLead: CustomerLeadListItem = {
  conversationId: 'c1',
  botId: 'bot1',
  hasLead: true,
  capturedLeadData: {
    name: 'Pat',
    email: 'pat@example.com',
    legacy_co: 'Acme',
    budget: '500',
    notes: 'Call back',
  },
  leadCapturedAt: null,
  startedFrom: null,
  sessionSource: null,
  lastActivityAt: null,
  startedAt: null,
  totalMessages: 0,
  totalCreditsUsed: 0,
  conversationOrigin: null,
  location: null,
  deviceInfo: null,
};

describe('LeadsTable historical column badges', () => {
  it('renders Inactive vs Deleted badges on Phone/Company headers and on extra captured-field tags', () => {
    const html = renderToStaticMarkup(
      <LeadsTable
        botId="bot1"
        leads={[sampleLead]}
        leadFieldDefinitions={leadFieldDefinitions}
        inboxColumns={[...inboxColumns]}
        onOpenDetail={() => {}}
        onOpenChat={() => {}}
      />,
    );
    expect(html).toContain('Inactive');
    expect(html).toContain('Deleted');
    expect(html).toContain('Company');
    expect(html).toContain('Acme');
    expect(html).toContain('Notes');
    expect(html).toContain('truncate">Email<');
    expect(html).toContain('truncate">Budget<');
    expect(html).toContain('truncate">Legacy Co<');
    expect(html).toContain('truncate">Name<');
    expect(html.toLowerCase()).not.toContain('archived');
  });
});
