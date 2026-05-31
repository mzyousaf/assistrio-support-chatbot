import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  addonKey: string;
  added: boolean;
  size?: number;
  className?: string;
};

export function BillingAddonIcon({ addonKey, added, size = 17, className }: Props) {
  return (
    <Package
      size={size}
      strokeWidth={1.75}
      className={cn('shrink-0 fill-none', added ? 'text-teal-600' : 'text-slate-400', className)}
      data-testid={`billing-addon-icon-${addonKey}`}
      data-added={added ? 'true' : 'false'}
      aria-hidden
    />
  );
}
