import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Card({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[var(--radius-lg)] border border-[var(--ui-border)] bg-[var(--ui-surface)] shadow-[var(--shadow-card)]',
          className,
        )}
        {...props}
      />
    );
  },
);

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-0.5 border-b border-slate-100/90 px-5 py-3.5',
          className,
        )}
        {...props}
      />
    );
  },
);

type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & { children: ReactNode };
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle(
  { className, children, ...props },
  ref,
) {
  return (
    <h3
      ref={ref}
      className={cn(
        'm-0 text-[0.8125rem] font-semibold leading-tight tracking-[-0.015em] text-slate-900',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
});

type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement> & { children: ReactNode };
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  function CardDescription({ className, children, ...props }, ref) {
    return (
      <p
        ref={ref}
        className={cn(
          'm-0 text-[0.75rem] leading-relaxed tracking-[-0.01em] text-slate-500',
          className,
        )}
        {...props}
      >
        {children}
      </p>
    );
  },
);

export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardBody({ className, ...props }, ref) {
    return <div ref={ref} className={cn('px-5 py-4', className)} {...props} />;
  },
);
