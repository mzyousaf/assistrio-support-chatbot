import { cn } from '@/lib/utils';

function Mini({ children, tone = 'slate' }: { children: string; tone?: 'slate' | 'teal' }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        tone === 'teal'
          ? 'border border-teal-200/90 bg-teal-50 text-teal-800'
          : 'border border-slate-200/90 bg-white text-slate-600',
      )}
    >
      {children}
    </span>
  );
}

type Props = {
  hasLead: boolean;
  hasVoice: boolean;
  hasDictation: boolean;
  hasAttachment: boolean;
  /** When set with hasVoice, badge shows e.g. "Voice 2". */
  voiceMessageCount?: number;
  /** When set with hasDictation, badge shows e.g. "Dictation 3". */
  dictationMessageCount?: number;
  className?: string;
};

export function ConversationStatusBadges({
  hasLead,
  hasVoice,
  hasDictation,
  hasAttachment,
  voiceMessageCount,
  dictationMessageCount,
  className,
}: Props) {
  const voiceLabel =
    hasVoice && typeof voiceMessageCount === 'number' && voiceMessageCount > 0
      ? `Voice ${voiceMessageCount}`
      : 'Voice';
  const dictLabel =
    hasDictation && typeof dictationMessageCount === 'number' && dictationMessageCount > 0
      ? `Dictation ${dictationMessageCount}`
      : 'Dictation';

  const items = (
    [
      { key: 'lead', show: hasLead, label: 'Lead', tone: 'teal' as const },
      { key: 'voice', show: hasVoice, label: voiceLabel, tone: 'slate' as const },
      { key: 'dictation', show: hasDictation, label: dictLabel, tone: 'slate' as const },
      { key: 'attach', show: hasAttachment, label: 'Files', tone: 'slate' as const },
    ] as const
  )
    .filter((x) => x.show)
    .map(({ key, label, tone }) => ({ key, label, tone }));
  if (!items.length) return null;
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {items.map((i) => (
        <Mini key={i.key} tone={i.tone}>
          {i.label}
        </Mini>
      ))}
    </span>
  );
}
