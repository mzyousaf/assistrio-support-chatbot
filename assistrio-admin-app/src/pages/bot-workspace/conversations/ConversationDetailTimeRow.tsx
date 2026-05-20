import { formatConversationAbsolute, formatConversationRelative } from '@/lib/conversationDateFormat';
import { Tooltip } from '@/components/ui';

type Props = { label: string; iso: string | null | undefined };

export function ConversationDetailTimeRow({ label, iso }: Props) {
  const abs = formatConversationAbsolute(iso);
  const rel = formatConversationRelative(iso);
  const empty = abs === '—' && rel === '—';
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="min-w-0 flex-1 text-sm text-slate-800">
        {empty ? (
          <span className="text-slate-400">—</span>
        ) : (
          <Tooltip content={abs} side="top" panelClassName="max-w-sm text-xs">
            <span className="cursor-default border-b border-dotted border-slate-300/90">{rel}</span>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
