import type { PlatformBotType } from '@/api/types';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<PlatformBotType, string> = {
  landing_demo: 'Landing demo',
  showcase: 'Showcase',
  support: 'Support',
  internal: 'Internal',
};

function typeLabel(type: PlatformBotType | string | undefined): string | null {
  if (!type) return null;
  if (type in TYPE_LABELS) return TYPE_LABELS[type as PlatformBotType];
  return String(type);
}

type Props = {
  isPlatformBot?: boolean;
  platformBotType?: PlatformBotType | string;
  className?: string;
};

export function PlatformBotBadges({ isPlatformBot, platformBotType, className }: Props) {
  if (!isPlatformBot) return null;
  const typeText = typeLabel(platformBotType);
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-violet-800">
        Platform
      </span>
      {typeText ? (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.6875rem] font-medium text-slate-600">
          {typeText}
        </span>
      ) : null}
    </div>
  );
}
