import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PostPublishInstallMode = 'chat-widget' | 'iframe';

const INSTALL_MODES: { id: PostPublishInstallMode; label: string }[] = [
  { id: 'chat-widget', label: 'Chat widget' },
  { id: 'iframe', label: 'Iframe' },
];

type Props = {
  allowedOrigins: readonly string[];
  widgetSnippet: string;
  iframeSnippet: string;
  compactCopyButton?: boolean;
};

export function PostPublishInstallPanel({
  allowedOrigins,
  widgetSnippet,
  iframeSnippet,
  compactCopyButton = false,
}: Props) {
  const [installMode, setInstallMode] = useState<PostPublishInstallMode>('chat-widget');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const activeSnippet = installMode === 'chat-widget' ? widgetSnippet : iframeSnippet;

  const snippetHint = useMemo(() => {
    if (installMode === 'chat-widget') {
      return 'Add this before the closing body tag';
    }
    return 'Embed this iframe on a page hosted on your allowed origin';
  }, [installMode]);

  async function copySnippet() {
    const text = activeSnippet.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback('Copied');
      window.setTimeout(() => setCopyFeedback(null), 2000);
    } catch {
      setCopyFeedback('Copy failed');
      window.setTimeout(() => setCopyFeedback(null), 2500);
    }
  }

  return (
    <div className="space-y-4">
      {allowedOrigins.length ? (
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 ring-1 ring-slate-900/[0.03]">
          <p className="m-0 mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Allowed sites
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allowedOrigins.map((origin, i) => (
              <span
                key={`${origin}-${i}`}
                className="max-w-full truncate rounded-md border border-slate-200/90 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-700 shadow-sm"
                title={origin}
              >
                {origin}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="inline-flex w-full flex-wrap gap-0.5 rounded-lg border border-slate-200/90 bg-white p-0.5 shadow-sm"
        role="tablist"
        aria-label="Install method"
      >
        {INSTALL_MODES.map((tab) => {
          const selected = installMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setInstallMode(tab.id)}
              className={cn(
                'min-h-9 min-w-0 flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition-all duration-200 sm:text-[0.8125rem]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/20',
                selected ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSnippet ? (
        <div role="tabpanel" className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 text-xs font-semibold text-slate-800">Embed snippet</p>
              <button
                type="button"
                className={cn(
                  'inline-flex shrink-0 items-center rounded-md border border-teal-200 bg-teal-50 font-semibold text-teal-800 transition-colors hover:bg-teal-100',
                  compactCopyButton
                    ? 'gap-1 px-2 py-1 text-[11px]'
                    : 'gap-1.5 px-2.5 py-1.5 text-xs',
                )}
                onClick={() => void copySnippet()}
              >
                {copyFeedback === 'Copied' ? (
                  <Check
                    size={compactCopyButton ? 12 : 13}
                    strokeWidth={2.5}
                    className="text-teal-700"
                    aria-hidden
                  />
                ) : (
                  <Copy size={compactCopyButton ? 12 : 13} strokeWidth={2} aria-hidden />
                )}
                {copyFeedback ?? 'Copy snippet'}
              </button>
            </div>
            <p className="m-0 mt-0.5 text-[11px] text-slate-500">{snippetHint}</p>
          </div>
          <pre className="m-0 min-h-[7.5rem] max-h-[min(22rem,52vh)] overflow-auto bg-[#0f172a] px-3 py-3 font-mono text-[0.6875rem] leading-relaxed text-slate-100">
            {activeSnippet}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
