import { Children, type ReactNode } from 'react';
import { ConversationDetailCopyButton } from './ConversationDetailCopyButton';
import { cn } from '@/lib/utils';

/** Padded outer wrapper shared by Insights CRM tabs + Chat transcript gutter. */
export const conversationInsightsDetailOuterClassName = 'min-h-0 w-full min-w-0 p-4';

/**
 * Single bordered panel wrapper for Insights CRM tabs (Stripe/Linear-style details sheet).
 */
export function ConversationInsightsSheet({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/90 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        className,
      )}
    >
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

type SectionProps = {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Merged after default `p-5` (e.g. lead drawer uses horizontal padding from parent). */
  className?: string;
};

/** Group heading + optional muted description + row list with thin horizontal rules. */
export function ConversationInsightsSheetSection({ title, description, children, footer, className }: SectionProps) {
  const rowLike = Children.toArray(children ?? null).filter(Boolean);
  const hasRows = rowLike.length > 0;

  return (
    <section className={cn('p-5', className)}>
      <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">{title}</h3>
      {description ? (
        <div className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate-500">{description}</div>
      ) : null}
      {hasRows ? <div className="mt-4 divide-y divide-slate-100">{children}</div> : null}
      {footer ? (
        <div className="mt-4 text-[12px] leading-relaxed text-slate-500">{footer}</div>
      ) : null}
    </section>
  );
}

type RowProps = {
  label: ReactNode;
  value: ReactNode;
  className?: string;
};

/** Two-column label / value pair (divider from parent divide-y). */
export function ConversationInsightsSheetRow({ label, value, className }: RowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-x-8 gap-y-1 py-2.5 sm:grid-cols-[minmax(11rem,40%)_1fr] sm:items-baseline',
        className,
      )}
    >
      <div className="text-[13px] text-slate-500">{label}</div>
      <div className="min-w-0 text-[13px] font-normal leading-snug text-slate-900 sm:text-left">{value}</div>
    </div>
  );
}

function safeHttpUrl(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isNonHttpStorageUrl(v: string): boolean {
  const lower = v.toLowerCase();
  return lower.startsWith('s3://') || lower.startsWith('file://') || lower.startsWith('ftp://');
}

/** Link + copy aligned like other sheet rows (Advanced tab URLs). */
export function ConversationInsightsSheetUrlRow({ label, url }: { label: string; url?: string }) {
  const v = url?.trim();
  if (!v) return null;
  if (isNonHttpStorageUrl(v)) {
    return (
      <ConversationInsightsSheetRow
        label={label}
        value={<span className="text-[12px] italic text-slate-500">Internal storage URL omitted</span>}
      />
    );
  }
  const link = safeHttpUrl(v);
  return (
    <ConversationInsightsSheetRow
      label={label}
      value={
        <span className="flex min-w-0 flex-wrap items-center justify-start gap-x-2 gap-y-1 sm:justify-start">
          {link ? (
            <a
              href={v}
              target="_blank"
              rel="noreferrer noopener"
              className="max-w-full break-all text-[13px] text-teal-700 underline decoration-teal-600/35 underline-offset-2 hover:text-teal-800"
              title={v}
            >
              {v}
            </a>
          ) : (
            <span className="break-all font-mono text-[12px] text-slate-800" title={v}>
              {v}
            </span>
          )}
          <ConversationDetailCopyButton value={v} ariaLabel={`Copy ${label}`} className="h-7" />
        </span>
      }
    />
  );
}
