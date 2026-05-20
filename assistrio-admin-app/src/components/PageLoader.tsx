import { cn } from '@/lib/utils';

export type PageLoaderSpinnerSize = 'page' | 'inline' | 'compact';

const SPINNER_DIM: Record<PageLoaderSpinnerSize, number> = {
  page: 40,
  inline: 32,
  compact: 24,
};

const SPINNER_BORDER: Record<PageLoaderSpinnerSize, number> = {
  page: 3,
  inline: 2.5,
  compact: 2,
};

type SpinnerProps = {
  size?: PageLoaderSpinnerSize;
  className?: string;
  /** When visible copy already conveys loading (e.g. next to a heading), mark the spinner decorative for AT. */
  decorative?: boolean;
};

/**
 * Animated Assistrio loader (waves + teal arc). Same graphic as full-page and workspace loading.
 */
export function PageLoaderSpinner({ size = 'inline', className, decorative = false }: SpinnerProps) {
  const dim = SPINNER_DIM[size];
  const bw = SPINNER_BORDER[size];

  return (
    <div
      className={cn('relative flex shrink-0 items-center justify-center', className)}
      style={{ width: dim, height: dim }}
      aria-hidden={decorative ? true : undefined}
    >
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0s' }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0.55s' }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.1s' }} />
      <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.65s' }} />

      <span
        className="absolute inset-0 rounded-full border-solid border-teal-100"
        style={{ borderWidth: bw }}
      />
      <span
        className="page-loader-spin absolute inset-0 rounded-full border-solid border-transparent border-t-teal-500 border-r-teal-500"
        style={{ borderWidth: bw }}
      />
    </div>
  );
}

type Props = {
  title?: string;
};

type InlineLoaderProps = Props & {
  /** Wrapper when embedding in dialogs or cards (centering, min-height). */
  className?: string;
};

export function PageLoader({ title = 'Loading…' }: Props) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center"
      style={{ background: 'var(--bg-app)' }}
      role="status"
      aria-live="polite"
    >
      <PageLoaderSpinner size="page" />

      <p className="page-loader-text mt-6 text-sm font-medium">{title}</p>
    </div>
  );
}

export function InlineLoader({ title = 'Loading…', className }: InlineLoaderProps) {
  return (
    <div
      className={cn('flex flex-1 flex-col items-center justify-center py-0', className)}
      role="status"
      aria-live="polite"
    >
      <PageLoaderSpinner size="inline" />

      <p className="page-loader-text mt-5 text-[0.8125rem] font-medium">{title}</p>
    </div>
  );
}
