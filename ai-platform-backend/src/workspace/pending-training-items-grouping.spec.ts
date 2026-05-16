import { mapKbSourceTypeToPendingSection } from './knowledge-overview.service';

describe('mapKbSourceTypeToPendingSection', () => {
  it('maps url/html to document', () => {
    expect(mapKbSourceTypeToPendingSection('url')).toBe('document');
    expect(mapKbSourceTypeToPendingSection('html')).toBe('document');
    expect(mapKbSourceTypeToPendingSection('document')).toBe('document');
  });

  it('maps faq, note, table, suggestion', () => {
    expect(mapKbSourceTypeToPendingSection('faq')).toBe('faq');
    expect(mapKbSourceTypeToPendingSection('note')).toBe('note');
    expect(mapKbSourceTypeToPendingSection('table')).toBe('table');
    expect(mapKbSourceTypeToPendingSection('suggestion')).toBe('suggestion');
  });

  it('returns null for unknown strings', () => {
    expect(mapKbSourceTypeToPendingSection('')).toBe(null);
    expect(mapKbSourceTypeToPendingSection('other')).toBe(null);
  });
});
