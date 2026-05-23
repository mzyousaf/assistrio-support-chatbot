import {
  mergeSnippetImportRows,
  parseSnippetImportSpreadsheet,
} from './workspace-onboarding-snippet-import.util';
import {
  ONBOARDING_KNOWLEDGE_SNIPPETS_MAX,
  ONBOARDING_SNIPPET_IMPORT_SKIPPED_REASON,
} from './workspace-onboarding-knowledge-limits.constants';

describe('workspace onboarding snippet import', () => {
  it('parses CSV with title, description, content columns', () => {
    const csv = Buffer.from(
      'title,description,content\nReturn policy,Summary,Full return details within 30 days.\n',
      'utf8',
    );
    const { rows, errors } = parseSnippetImportSpreadsheet(csv, 'snippets.csv');
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Return policy');
    expect(rows[0]?.description).toBe('Summary\n\nFull return details within 30 days.');
  });

  it('accepts content-only body rows', () => {
    const csv = Buffer.from(
      'title,description,content\nSupport hours,,Live chat is available weekdays.\n',
      'utf8',
    );
    const { rows, errors } = parseSnippetImportSpreadsheet(csv, 'snippets.csv');
    expect(errors).toHaveLength(0);
    expect(rows[0]?.description).toBe('Live chat is available weekdays.');
  });

  it('reports missing title and body validation errors', () => {
    const csv = Buffer.from(
      'title,description,content\n,,Some content\nReturn policy,,\n',
      'utf8',
    );
    const { rows, errors } = parseSnippetImportSpreadsheet(csv, 'snippets.csv');
    expect(rows).toHaveLength(0);
    expect(errors.some((e) => e.column === 'title')).toBe(true);
    expect(errors.some((e) => e.column === 'content')).toBe(true);
  });

  it('imports valid rows up to max 5', () => {
    const incoming = Array.from({ length: 3 }, (_, i) => ({
      title: `Snippet ${i + 1}`,
      description: `Body ${i + 1}`,
    }));
    const existing = Array.from({ length: ONBOARDING_KNOWLEDGE_SNIPPETS_MAX - 2 }, (_, i) => ({
      id: `existing-${i}`,
      title: `Existing ${i}`,
      description: 'Existing body',
      createdAt: null,
      updatedAt: null,
    }));
    const result = mergeSnippetImportRows(existing, incoming);
    expect(result.imported).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.skippedReason).toBe(ONBOARDING_SNIPPET_IMPORT_SKIPPED_REASON);
    expect(result.merged).toHaveLength(ONBOARDING_KNOWLEDGE_SNIPPETS_MAX);
  });
});
