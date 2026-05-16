import { cn } from '@/lib/utils';

type Layout = 'chats' | 'knowledge' | 'leads' | 'topics' | 'sentiment';

const layoutKpi: Record<Layout, number> = {
  chats: 6,
  knowledge: 6,
  leads: 3,
  topics: 0,
  sentiment: 2,
};

const layoutGridLg: Record<Layout, string> = {
  chats: 'lg:grid-cols-6',
  knowledge: 'lg:grid-cols-6',
  leads: 'lg:grid-cols-3',
  topics: 'lg:grid-cols-6',
  sentiment: '', // KPI row uses bespoke cols below (matches AnalyticsKpiGrid)
};

type Props = { layout: Layout };

export function AnalyticsPageSkeleton({ layout }: Props) {
  const pulse = 'animate-pulse rounded-md bg-slate-200/80';
  const kpi = layoutKpi[layout];

  return (
    <div className="space-y-6">
      {kpi > 0 ? (
        <div
          className={cn(
            'grid gap-3',
            layout === 'sentiment'
              ? cn('grid-cols-1 sm:grid-cols-3', layoutGridLg.leads)
              : cn('grid-cols-2 sm:grid-cols-3', layoutGridLg[layout]),
          )}
        >
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
            : layout === 'sentiment' || layout === 'leads'
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
      {layout === 'leads' ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(pulse, 'h-[280px] w-full')} />
            <div className={cn(pulse, 'h-[280px] w-full')} />
          </div>
          <div className={cn(pulse, 'min-h-[220px] w-full')} />
        </>
      ) : null}
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
