import type { ElementType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  children: ReactNode;
  id?: string;
  as?: ElementType;
  className?: string;
  iconVariant?: 'default' | 'tip';
  iconClassName?: string;
  titleClassName?: string;
};

/** Icon aligned inline with a section heading only (not description/helper copy). */
export function OnboardingSectionHeading({
  icon: Icon,
  children,
  id,
  as: Tag = 'h3',
  className,
  iconVariant = 'default',
  iconClassName,
  titleClassName,
}: Props) {
  return (
    <div className={cn('onboarding-section-heading-row', className)}>
      <span
        className={cn(
          'onboarding-section-heading-icon',
          iconVariant === 'tip' && 'onboarding-section-heading-icon--tip',
          iconClassName,
        )}
        aria-hidden
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <Tag id={id} className={cn('onboarding-section-heading-title', titleClassName)}>
        {children}
      </Tag>
    </div>
  );
}
