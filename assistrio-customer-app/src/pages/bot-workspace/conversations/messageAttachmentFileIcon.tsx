import type { ComponentProps } from 'react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { cn } from '@/lib/utils';

type FileIconStyleKey = keyof typeof defaultStyles;

const FALLBACK_KEY: FileIconStyleKey = 'txt';

function fileExtensionHint(fileName: unknown, fileType: unknown): string {
  const name = String(fileName ?? '');
  const base = name.split(/[/\\]/).pop() ?? '';
  if (base.includes('.')) {
    return base.split('.').pop()!.toLowerCase();
  }
  const raw = String(fileType ?? '')
    .trim()
    .toLowerCase();
  if (!raw || raw === 'unknown') return '';
  if (raw.includes('/')) return '';
  const token = raw.replace(/^\./, '');
  if (token.length <= 12 && /^[a-z0-9]+$/i.test(token)) return token;
  return '';
}

function fileIconStyleKeyFromMime(mime: string): FileIconStyleKey | null {
  const m = mime.toLowerCase();
  if (!m.includes('/')) return null;
  if (m.includes('pdf')) return 'pdf';
  if (m.startsWith('image/')) return 'png';
  if (m.startsWith('video/')) return 'mp4';
  if (m.startsWith('audio/')) return 'mp3';
  if (m.includes('wordprocessing') || m === 'application/msword') return 'docx';
  if (m.includes('spreadsheet') || m.includes('excel')) return 'xlsx';
  if (m === 'text/csv') return 'csv';
  if (m.includes('presentation') || m.includes('powerpoint')) return 'pptx';
  if (m === 'application/json' || m.endsWith('+json')) return 'json';
  if (m === 'application/javascript' || m === 'text/javascript' || m.includes('javascript')) return 'js';
  if (m === 'text/html') return 'html';
  if (m === 'text/css') return 'css';
  if (m === 'application/xml' || m === 'text/xml') return 'html';
  if (m.startsWith('text/')) return 'txt';
  if (
    m === 'application/zip' ||
    m === 'application/x-zip-compressed' ||
    m.includes('compressed') ||
    m.includes('archive')
  ) {
    return 'zip';
  }
  return null;
}

const FILE_ICON_EXT_ALIASES: Partial<Record<string, FileIconStyleKey>> = {
  tsx: 'ts',
  cjs: 'js',
  mjs: 'js',
  mts: 'ts',
  cts: 'ts',
  vue: 'js',
  svelte: 'js',
  mdx: 'md',
  markdown: 'md',
  jpeg: 'jpg',
  pyw: 'py',
};

function resolveFileIconStyleKey(fileName: unknown, fileType: unknown): FileIconStyleKey {
  const ext = fileExtensionHint(fileName, fileType);
  const mime = String(fileType ?? '')
    .trim()
    .toLowerCase();

  if (ext) {
    if (ext in defaultStyles) return ext as FileIconStyleKey;
    const aliased = FILE_ICON_EXT_ALIASES[ext];
    if (aliased) return aliased;
  }

  const fromMime = fileIconStyleKeyFromMime(mime);
  if (fromMime) return fromMime;

  if (ext) {
    if (/^(gz|bz2|tgz|7z|tar|rar)$/.test(ext)) return 'zip';
    if (/^(webm|avi|wmv)$/.test(ext)) return 'mp4';
    if (/^(flac|ogg|m4a)$/.test(ext)) return 'mp3';
    if (/^(yaml)$/.test(ext)) return 'yml';
  }

  return FALLBACK_KEY;
}

function extensionLabel(fileName: unknown, fileType: unknown): string {
  const ext = fileExtensionHint(fileName, fileType);
  if (ext) {
    const u = ext.toUpperCase();
    return u.length <= 4 ? u : u.slice(0, 4);
  }
  const m = String(fileType ?? '').toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.startsWith('image/')) return 'IMG';
  if (m.startsWith('video/')) return 'VID';
  if (m.startsWith('audio/')) return 'AUD';
  if (m.includes('json')) return 'JSON';
  return 'FILE';
}

export function conversationAttachmentFileIconProps(
  fileName: unknown,
  fileType: unknown,
): ComponentProps<typeof FileIcon> {
  const key = resolveFileIconStyleKey(fileName, fileType);
  return {
    ...(defaultStyles[key] as ComponentProps<typeof FileIcon>),
    extension: extensionLabel(fileName, fileType),
  };
}

type Props = {
  fileName: string;
  mimeType: string;
  className?: string;
};

/** `react-file-icon` tile sized for conversation attachment rows. */
export function ConversationAttachmentFileIcon({ fileName, mimeType, className }: Props) {
  const props = conversationAttachmentFileIconProps(fileName, mimeType);
  return (
    <span
      className={cn(
        'inline-flex aspect-[40/48] h-10 w-auto max-h-10 shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-slate-200/90',
        className,
      )}
      aria-hidden
    >
      <FileIcon {...props} />
    </span>
  );
}
