import type { ReactNode } from 'react';
import { Check, Loader2, PencilLine, Rocket } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { GoLiveWhatHappensNextItem } from './goLiveConfirmCopy';

export type GoLiveWhatHappensNextEntry = string | GoLiveWhatHappensNextItem;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  action: 'publish' | 'draft';
  whatHappensNext: readonly GoLiveWhatHappensNextEntry[];
  /** Onboarding go-live: smaller copy + distinct icon per row. */
  itemVariant?: 'default' | 'onboarding';
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  /** True while pre-publish save / API work is in flight. */
  confirming?: boolean;
};

function entryKey(entry: GoLiveWhatHappensNextEntry, index: number): string {
  return typeof entry === 'string' ? entry : entry.key || String(index);
}

export function GoLiveConfirmModal({
  open,
  onClose,
  onConfirm,
  action,
  whatHappensNext,
  itemVariant = 'default',
  title,
  description,
  confirmLabel,
  confirming = false,
}: Props) {
  const isDraft = action === 'draft';
  const isOnboarding = itemVariant === 'onboarding';

  return (
    <Modal
      open={open}
      onClose={onClose}
      tone="default"
      className="max-w-md"
      allowDismiss={!confirming}
      title={
        title ??
        (isDraft ? (
          <span className="inline-flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200/95 bg-slate-100 text-slate-700 shadow-sm ring-1 ring-slate-900/[0.04]"
              aria-hidden
            >
              <PencilLine className="h-5 w-5" strokeWidth={2} />
            </span>
            Move to draft
          </span>
        ) : (
          <span className="inline-flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-100 bg-teal-50 text-teal-600 shadow-sm"
              aria-hidden
            >
              <Rocket className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Go live
          </span>
        ))
      }
      description={
        description ??
        (isDraft ? (
          <span>
            On your allowed websites, the embed will stop showing this agent until you publish again. You can go live
            again whenever you are ready.
          </span>
        ) : (
          <span>
            This turns on your chat widget for the allowed websites you configured. You can return to draft anytime.
          </span>
        ))
      }
      size="md"
      footer={
        <>
          <button
            type="button"
            className="inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(
              'inline-flex h-10 min-w-[8.5rem] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-80',
              isDraft
                ? 'border border-transparent bg-[var(--color-danger-text-emphasis)] text-white hover:bg-[var(--color-danger-text)] focus-visible:outline-[var(--color-danger-text-emphasis)]'
                : 'bg-teal-600 hover:bg-teal-700 focus-visible:outline-teal-600',
            )}
            onClick={() => void onConfirm()}
            disabled={confirming}
            aria-busy={confirming}
          >
            {confirming ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="shrink-0 animate-spin" aria-hidden />
                {isDraft ? 'Moving to draft…' : 'Going live…'}
              </>
            ) : (
              confirmLabel ??
              (isDraft ? (
                <>
                  <PencilLine size={16} strokeWidth={2} className="shrink-0" aria-hidden />
                  Move to draft
                </>
              ) : (
                <>
                  <Rocket size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                  Go live
                </>
              ))
            )}
          </button>
        </>
      }
    >
      <div
        className={
          isDraft
            ? 'rounded-xl border border-slate-200 bg-slate-100/70 p-3.5 ring-1 ring-slate-900/[0.05]'
            : 'rounded-xl border border-slate-200/90 bg-slate-50/80 p-3.5 ring-1 ring-slate-900/[0.04]'
        }
      >
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">What happens next</p>
        <ul
          className={cn(
            'm-0 list-none p-0 leading-snug text-slate-700',
            isOnboarding ? 'mt-3 space-y-3 text-xs' : 'mt-2.5 space-y-2 text-sm',
          )}
        >
          {whatHappensNext.map((entry, index) => {
            const Icon = typeof entry === 'string' ? Check : entry.icon;
            const text = typeof entry === 'string' ? entry : entry.text;
            return (
              <li
                key={entryKey(entry, index)}
                className={cn('flex items-start', isOnboarding ? 'gap-2.5' : 'gap-2')}
              >
                <span
                  className={cn(
                    'mt-0.5 flex shrink-0 items-center justify-center rounded-md bg-white/80 text-teal-600 ring-1 ring-slate-200/80',
                    isOnboarding ? 'h-5 w-5' : 'h-4 w-4',
                    isDraft && !isOnboarding && 'text-slate-600',
                  )}
                  aria-hidden
                >
                  <Icon className={isOnboarding ? 'size-3' : 'size-3.5'} strokeWidth={2} />
                </span>
                <span className="min-w-0">{text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
