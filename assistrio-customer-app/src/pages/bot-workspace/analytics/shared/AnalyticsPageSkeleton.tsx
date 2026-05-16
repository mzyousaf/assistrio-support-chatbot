import { cn } from '@/lib/utils';

type Layout = 'chats' | 'knowledge' | 'leads' | 'topics' | 'sentiment';

const layoutKpi: Record<Layout, number> = {
  chats: 6,
  knowledge: 6,
  leads: 5,
  topics: 0,
  sentiment: 2,
};

const layoutGridLg: Record<Layout, string> = {
  chats: 'lg:grid-cols-6',
  knowledge: 'lg:grid-cols-6',
  leads: 'lg:grid-cols-5',
  topics: 'lg:grid-cols-6',
  sentiment: 'lg:grid-cols-2',
};

type Props = { layout: Layout };

export function AnalyticsPageSkeleton({ layout }: Props) {
  const pulse = 'animate-pulse rounded-md bg-slate-200/80';
  const kpi = layoutKpi[layout];
  const lg = layoutGridLg[layout];

  return (
    <div className="space-y-6">
      {kpi > 0 ? (
        <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', lg)}>
          {Array.from({ length: kpi }).map((_, i) => (
            <div key={i} className={cn('h-24 rounded-md', pulse)} />
          ))}
        </div>
      ) : null}
      <div
        className={cn(
          pulse,
          layout === 'topics'
            ? 'h-[495px] min-h-[495px]'
            : layout === 'sentiment'
              ? 'h-[495px] min-h-[495px]'
              : 'h-72',
          'w-full',
        )}
      />
      {layout === 'topics' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cn(pulse, 'h-[280px] min-h-[15rem] w-full')} />
          <div className={cn(pulse, 'h-[280px] min-h-[15rem] w-full')} />
        </div>
      ) : null}
      {layout === 'leads' ? <div className={cn(pulse, 'h-56 w-full')} /> : null}
      {layout !== 'leads' && layout !== 'topics' && layout !== 'sentiment' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={cn(pulse, 'h-64')} />
          <div className={cn(layout === 'knowledge' ? 'h-48' : 'h-64', pulse)} />
        </div>
      ) : null}
      {layout === 'knowledge' ? <div className={cn(pulse, 'h-56 w-full')} /> : null}
    </div>
  );
}
