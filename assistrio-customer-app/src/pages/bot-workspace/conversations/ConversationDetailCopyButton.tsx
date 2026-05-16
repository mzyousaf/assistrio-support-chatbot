import { useCallback, useState } from 'react';
import { Copy } from 'lucide-react';
import { copyTextToClipboard } from '@/lib/copyToClipboard';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  ariaLabel: string;
  className?: string;
};

export function ConversationDetailCopyButton({ value, ariaLabel, className }: Props) {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    const ok = await copyTextToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <button
      type="button"
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => void onClick()}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200/90 bg-white px-1.5 text-[11px] font-medium text-teal-700 transition hover:border-teal-200 hover:bg-teal-50/60',
        className,
      )}
      aria-label={ariaLabel}
    >
      <Copy size={12} className="text-teal-600" strokeWidth={2} aria-hidden />
      {copied ? <span className="text-teal-800">Copied</span> : null}
    </button>
  );
}
