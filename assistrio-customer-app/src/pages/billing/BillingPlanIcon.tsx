import { planPricingCardIcon } from '@/pages/billing/planPricingCardDisplay';
import { cn } from '@/lib/utils';

type Props = {
  planKey: string;
  size?: number;
  className?: string;
};

export function BillingPlanIcon({ planKey, size = 22, className }: Props) {
  const { icon: Icon, className: iconClassName } = planPricingCardIcon(planKey);

  return (
    <Icon
      size={size}
      strokeWidth={1.75}
      className={cn('shrink-0', iconClassName, className)}
      aria-hidden
    />
  );
}
