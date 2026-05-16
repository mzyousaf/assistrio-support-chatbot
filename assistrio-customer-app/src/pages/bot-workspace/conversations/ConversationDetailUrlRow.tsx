import { ConversationDetailCopyButton } from './ConversationDetailCopyButton';
import { ConversationDetailRow } from './ConversationDetailRow';

type Props = {
  label: string;
  url: string | undefined;
};

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isNonHttpStorageUrl(v: string): boolean {
  const lower = v.toLowerCase();
  return lower.startsWith('s3://') || lower.startsWith('file://') || lower.startsWith('ftp://');
}

export function ConversationDetailUrlRow({ label, url }: Props) {
  const v = url?.trim();
  if (!v) return null;
  if (isNonHttpStorageUrl(v)) {
    return (
      <ConversationDetailRow
        label={label}
        value={<span className="text-xs italic text-slate-500">Internal storage URL (not shown)</span>}
      />
    );
  }
  const link = isHttpUrl(v);
  return (
    <ConversationDetailRow
      label={label}
      value={
        <span className="flex min-w-0 items-start gap-2">
          {link ? (
            <a
              href={v}
              target="_blank"
              rel="noreferrer noopener"
              className="min-w-0 flex-1 truncate text-teal-700 underline decoration-teal-600/30 underline-offset-2 hover:text-teal-800"
              title={v}
            >
              {v}
            </a>
          ) : (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800" title={v}>
              {v}
            </span>
          )}
          <ConversationDetailCopyButton value={v} ariaLabel={`Copy ${label}`} />
        </span>
      }
    />
  );
}
