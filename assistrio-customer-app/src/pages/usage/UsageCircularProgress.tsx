import { cn } from '@/lib/utils';

type Tone = 'default' | 'warning' | 'danger';

type Props = {
  percent: number;
  ariaLabel: string;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
};

const toneStroke: Record<Tone, string> = {
  default: '#0d9488',
  warning: '#d97706',
  danger: '#dc2626',
};

export function UsageCircularProgress({
  percent,
  ariaLabel,
  size = 48,
  strokeWidth = 4,
  tone = 'default',
}: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out')}
        />
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.6875rem] font-semibold tabular-nums text-slate-700">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}
