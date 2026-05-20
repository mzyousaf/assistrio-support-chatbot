import { formatKnowledgeBytes } from '@/lib/formatKnowledgeBytes';
import { utf8ByteLength } from '@/lib/knowledgeContentUtf8Limits';
import { cn } from '@/lib/utils';

export function KnowledgeUtf8Meter({
  value,
  maxBytes,
  className,
  id,
  /** When set, shown as the “used” count instead of UTF-8 length of `value` (e.g. suggestion chip text → 0 KB usage). */
  displayUsedBytes,
  /** `'bytes'` = `formatKnowledgeBytes` (default). `'plain'` = `used / max` as numbers (no B/KB suffix); use when the limit is not storage-sized (e.g. chip text cap vs KB). */
  displayFormat = 'bytes',
}: {
  value: string;
  maxBytes: number;
  className?: string;
  id?: string;
  displayUsedBytes?: number;
  displayFormat?: 'bytes' | 'plain';
}) {
  const n = displayUsedBytes !== undefined ? displayUsedBytes : utf8ByteLength(value);
  const over = n > maxBytes;
  const label =
    displayFormat === 'plain'
      ? `${n}/${maxBytes}`
      : `${formatKnowledgeBytes(n)} / ${formatKnowledgeBytes(maxBytes)}`;
  return (
    <span
      id={id}
      className={cn(
        'font-normal tabular-nums text-xs',
        over ? undefined : 'text-slate-500',
        className,
        over ? 'text-amber-800' : undefined,
      )}
      aria-live="polite"
    >
      {label}
    </span>
  );
}
