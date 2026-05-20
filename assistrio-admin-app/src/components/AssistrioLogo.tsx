import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  /** Square mark (logo-180x180). */
  markClassName?: string;
  /** Horizontal wordmark image (logo-text.png). */
  wordmarkClassName?: string;
  showWordmark?: boolean;
};

/** Assistrio mark + horizontal wordmark — same assets as customer app (`public/logo-*.png`). */
export function AssistrioLogo({
  className,
  markClassName = 'h-7 w-7 shrink-0 object-contain',
  wordmarkClassName = 'h-6 w-auto max-w-[9.5rem] object-contain object-left',
  showWordmark = true,
}: Props) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>
      <img
        src="/logo-180x180.png"
        alt=""
        width={28}
        height={28}
        className={markClassName}
        decoding="async"
      />
      {showWordmark ? (
        <img
          src="/logo-text.png"
          alt="Assistrio"
          width={140}
          height={26}
          className={wordmarkClassName}
          decoding="async"
        />
      ) : null}
    </span>
  );
}
