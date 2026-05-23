export const SNIPPET_IMPORT_SAMPLE_CSV =
  'title,description,content\nReturn policy,Short summary,Customers can request returns within 30 days of purchase with proof of order.\nSupport hours,,Live chat support is available Monday-Friday 9 AM to 6 PM.\n';

export function downloadSnippetSampleSpreadsheet(): void {
  const blob = new Blob([SNIPPET_IMPORT_SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'assistrio-snippets-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}
