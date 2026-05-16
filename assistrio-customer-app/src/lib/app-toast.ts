import type { MouseEvent } from 'react';
import { toast, type ExternalToast } from 'sonner';

export type AppToastAction = {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * Optional actions: `primary` is the solid button (e.g. Retry); `secondary` is outlined (e.g. Help).
 * Sonner renders cancel before action in the DOM; CSS re-orders so primary reads left-first.
 */
export type AppToastOptions = Pick<ExternalToast, 'description' | 'duration' | 'id'> & {
  primary?: AppToastAction;
  secondary?: AppToastAction;
};

function toSonnerActions(opts?: AppToastOptions): Pick<ExternalToast, 'action' | 'cancel'> {
  if (!opts?.primary && !opts?.secondary) return {};
  return {
    ...(opts.primary
      ? { action: { label: opts.primary.label, onClick: opts.primary.onClick } }
      : {}),
    ...(opts.secondary
      ? { cancel: { label: opts.secondary.label, onClick: opts.secondary.onClick } }
      : {}),
  };
}

function baseOpts(opts?: AppToastOptions): ExternalToast {
  const { primary: _p, secondary: _s, ...rest } = opts ?? {};
  return {
    ...rest,
    ...toSonnerActions(opts),
  };
}

/** Single import site for app toasts (Sonner + shared styling via `AppToaster`). */
export const appToast = {
  success: (message: string, opts?: AppToastOptions) => toast.success(message, baseOpts(opts)),

  error: (message: string, opts?: AppToastOptions) => toast.error(message, baseOpts(opts)),

  warning: (message: string, opts?: AppToastOptions) => toast.warning(message, baseOpts(opts)),

  info: (message: string, opts?: AppToastOptions) => toast.info(message, baseOpts(opts)),
};
