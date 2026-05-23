export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10_485_760 ? 1 : 0)} MB`;
}

export function fileExtensionLabel(name: string): string {
  const ext = name.split('.').pop()?.trim().toUpperCase();
  return ext && ext.length <= 8 ? ext : 'FILE';
}
