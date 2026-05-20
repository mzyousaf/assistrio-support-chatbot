import { cn } from '@/lib/utils';

const LABEL: Record<string, string> = {
  text: 'Text',
  voice: 'Voice',
  dictation: 'Dictation',
  attachment: 'File',
  suggested_question: 'Suggested',
  unknown: 'Message',
};

function labelFor(inputType: string | undefined): string {
  const t = (inputType ?? '').trim().toLowerCase();
  if (!t) return 'Message';
  if (t === 'quick_reply') return 'Message';
  return LABEL[t] ?? 'Message';
}

function stylesFor(inputType: string | undefined): string {
  const t = (inputType ?? '').trim().toLowerCase();
  if (t === 'text') return 'border-slate-200/90 bg-slate-50 text-slate-600';
  if (t === 'voice') return 'border-sky-200/90 bg-sky-50 text-sky-900';
  if (t === 'dictation') return 'border-indigo-200/90 bg-indigo-50 text-indigo-900';
  if (t === 'attachment') return 'border-amber-200/90 bg-amber-50/90 text-amber-950';
  if (t === 'suggested_question') return 'border-teal-200/90 bg-teal-50 text-teal-900';
  if (t === 'quick_reply') return 'border-slate-200/90 bg-slate-100 text-slate-600';
  return 'border-slate-200/90 bg-slate-100 text-slate-600';
}

type Props = {
  inputType?: string;
  inputMethod?: string;
  className?: string;
};

export function MessageInputTypeBadge({ inputType, inputMethod, className }: Props) {
  const title = inputMethod?.trim()
    ? `Input: ${labelFor(inputType)} · ${inputMethod}`
    : `Input: ${labelFor(inputType)}`;
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
        stylesFor(inputType),
        className,
      )}
    >
      {labelFor(inputType)}
    </span>
  );
}
