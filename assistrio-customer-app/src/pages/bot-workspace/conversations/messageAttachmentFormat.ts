export function formatAttachmentSizeBytes(n: number | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${Math.round(n)} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

const EXT_PRETTY: Record<string, string> = {
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
  csv: 'CSV',
  ppt: 'Slides',
  pptx: 'Slides',
  pdf: 'PDF',
  png: 'PNG',
  jpg: 'JPEG',
  jpeg: 'JPEG',
  gif: 'GIF',
  webp: 'WebP',
  svg: 'SVG',
  zip: 'ZIP',
  rar: 'Archive',
  '7z': 'Archive',
  mp3: 'Audio',
  wav: 'Audio',
  mp4: 'Video',
  mov: 'Video',
  txt: 'Text',
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  js: 'JavaScript',
  ts: 'TypeScript',
};

function extensionFromFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? '';
  if (!base.includes('.')) return '';
  return base.split('.').pop()!.toLowerCase();
}

/**
 * Short label for attachment rows (not raw MIME). Prefers friendly names over `application/…` strings.
 */
export function shortAttachmentTypeLabel(mime: string, fileName: string): string {
  const m = mime.toLowerCase().trim();
  if (m && m !== 'application/octet-stream') {
    if (m.includes('pdf')) return 'PDF';
    if (m.includes('wordprocessing') || m === 'application/msword') return 'Word';
    if (m === 'text/csv') return 'CSV';
    if (m.includes('spreadsheet') || m.includes('excel')) return 'Excel';
    if (m.includes('presentation') || m.includes('powerpoint')) return 'Slides';
    if (m.includes('json')) return 'JSON';
    if (m.startsWith('text/html')) return 'HTML';
    if (m.startsWith('text/css')) return 'CSS';
    if (m === 'text/plain' || m.startsWith('text/')) return 'Text';
    if (m.startsWith('image/')) {
      if (m.includes('png')) return 'PNG';
      if (m.includes('jpeg') || m.includes('jpg')) return 'JPEG';
      if (m.includes('gif')) return 'GIF';
      if (m.includes('webp')) return 'WebP';
      if (m.includes('svg')) return 'SVG';
      return 'Image';
    }
    if (m.startsWith('video/')) return 'Video';
    if (m.startsWith('audio/')) return 'Audio';
    if (
      m.includes('zip') ||
      m.includes('compressed') ||
      m.includes('archive') ||
      m === 'application/x-7z-compressed'
    ) {
      return 'Archive';
    }
  }

  const ext = extensionFromFileName(fileName);
  if (ext && EXT_PRETTY[ext]) return EXT_PRETTY[ext];
  if (ext && ext.length <= 8 && /^[a-z0-9]+$/i.test(ext)) return ext.toUpperCase();

  return '';
}

/** One line for modal/list: `Word · 24 KB` */
export function formatAttachmentMetaLine(
  mime: string,
  fileName: string,
  sizeBytes: number | undefined,
): string {
  const kind = shortAttachmentTypeLabel(mime, fileName);
  const size = formatAttachmentSizeBytes(sizeBytes);
  return [kind, size].filter(Boolean).join(' · ');
}

