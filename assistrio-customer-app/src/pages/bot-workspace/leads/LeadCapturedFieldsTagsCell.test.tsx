import type { CustomerLeadListItem } from '@/api/types';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadCapturedFieldsTagsCell } from './LeadCapturedFieldsTagsCell';

function minimalLead(overrides: Partial<CustomerLeadListItem> = {}): CustomerLeadListItem {
  return {
    conversationId: 'c1',
    botId: 'b1',
    hasLead: true,
    capturedLeadData: {},
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
    ...overrides,
  };
}

describe('LeadCapturedFieldsTagsCell', () => {
  it('shows at most five field tags then +N for the rest', () => {
    const fieldDefinitions = Array.from({ length: 7 }, (_, i) => ({
      key: `f${i}`,
      label: `Field ${i}`,
      type: 'text',
      required: false,
      order: i,
      fieldStatus: 'active' as const,
    }));
    const capturedLeadData = Object.fromEntries(fieldDefinitions.map((d) => [d.key, 'v']));
    const html = renderToStaticMarkup(
      <LeadCapturedFieldsTagsCell
        lead={minimalLead({ capturedLeadData })}
        fieldDefinitions={fieldDefinitions}
        excludeFieldKeys={[]}
      />,
    );
    expect(html).toContain('Field 0');
    expect(html).toContain('Field 4');
    expect((html.match(/min-w-0 truncate">Field/g) ?? []).length).toBe(5);
    expect(html).toContain('+2');
  });
});
