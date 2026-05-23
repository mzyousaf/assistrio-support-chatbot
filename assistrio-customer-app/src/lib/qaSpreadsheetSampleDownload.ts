/** Same template as playground Q&A import (`GET …/faqs/import-csv-sample`). */
export const QA_IMPORT_SAMPLE_CSV =
  'title,questions,answer\nShipping and returns,When do you ship?|How long is delivery?,We ship within 1-2 business days.\nRefund policy,Can I get a refund?|How do returns work?,You can request a refund within 30 days with your order number.\n';

export function downloadQaSampleSpreadsheet(): void {
  const blob = new Blob([QA_IMPORT_SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qa-import-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}
