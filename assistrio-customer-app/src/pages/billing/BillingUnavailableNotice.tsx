import { AlertCircle } from 'lucide-react';
import { isWorkspaceOwnerRole } from '@/lib/workspaceRoles';
import { cn } from '@/lib/utils';

type Props = {
  role: string | null | undefined;
  variant?: 'chip' | 'banner';
  className?: string;
  /** When true, checkout is configured and this notice is hidden. */
  checkoutEnabled?: boolean;
};

export function BillingUnavailableNotice({
  role,
  variant = 'banner',
  className,
  checkoutEnabled = false,
}: Props) {
  if (checkoutEnabled) return null;

  const isOwner = isWorkspaceOwnerRole(role);
  const message = isOwner
    ? 'Checkout is not enabled yet.'
    : 'Only workspace owners will be able to manage billing when payments are enabled.';

  if (variant === 'chip') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-[var(--shadow-xs)]',
          className,
        )}
        role="status"
      >
        <AlertCircle size={14} aria-hidden className="shrink-0 text-amber-700" />
        {message}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3',
        className,
      )}
      role="status"
    >
      <p className="m-0 text-sm leading-relaxed text-slate-600">{message}</p>
    </div>
  );
}
