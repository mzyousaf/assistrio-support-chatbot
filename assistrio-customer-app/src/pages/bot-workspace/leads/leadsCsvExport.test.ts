import { describe, expect, it } from 'vitest';
import { buildLeadsCsvLines, escapeCsvCell, leadsExportFilenameDate } from './leadsCsvExport';
import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';

describe('leadsCsvExport', () => {
  it('escapeCsvCell quotes commas and escapes quotes', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('buildLeadsCsvLines matches column order', () => {
    const defs: CustomerLeadFieldDefinition[] = [
      { key: 'email', label: 'Email', type: 'text', required: false, order: 0 },
      { key: 'name', label: 'Full name', type: 'text', required: false, order: 1, disabled: true, fieldStatus: 'inactive', archived: true },
    ];
    const leads: CustomerLeadListItem[] = [
      {
        conversationId: 'c1',
        botId: 'b1',
        capturedLeadData: { email: 'u@x.com' },
        leadCapturedAt: '2024-06-01T12:00:00.000Z',
        hasLead: true,
        startedFrom: 'runtime_widget',
        sessionSource: null,
        lastActivityAt: null,
        startedAt: null,
        totalMessages: 1,
        totalCreditsUsed: 0,
        conversationOrigin: { pageUrl: 'https://ex.com/p' },
        location: { country: 'US', city: 'Austin' },
        deviceInfo: null,
      },
    ];
    const lines = buildLeadsCsvLines(leads, defs);
    expect(lines.length).toBe(2);
    const header = lines[0].split(',');
    expect(header[0]).toBe('Captured at');
    expect(header[1]).toBe('Email');
    expect(header[2]).toBe('Full name (Inactive)');
    expect(header[header.length - 1]).toBe('Conversation ID');
  });

  it('leadsExportFilenameDate matches YYYY-MM-DD', () => {
    const n = leadsExportFilenameDate();
    expect(n).toMatch(/^assistrio-leads-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
