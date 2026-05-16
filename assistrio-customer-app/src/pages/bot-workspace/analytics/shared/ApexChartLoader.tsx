import type { ApexOptions } from 'apexcharts';
import { lazy, Suspense, type ReactNode } from 'react';

const ReactApexChart = lazy(async () => {
  const m = await import('react-apexcharts');
  return { default: m.default };
});

export type ApexChartLoaderBaseProps = {
  options?: ApexOptions;
  series?: ApexOptions['series'];
  type?:
    | 'line'
    | 'area'
    | 'bar'
    | 'pie'
    | 'donut'
    | 'radialBar'
    | 'scatter'
    | 'bubble'
    | 'heatmap'
    | 'candlestick'
    | 'boxPlot'
    | 'radar'
    | 'polarArea'
    | 'rangeBar'
    | 'rangeArea'
    | 'treemap';
  width?: string | number;
  height?: string | number;
};

export type ApexChartLoaderProps = ApexChartLoaderBaseProps & {
  suspenseFallback?: ReactNode;
};

const defaultFallback = (
  <div className="h-full min-h-[200px] w-full animate-pulse rounded-md bg-slate-50/90" aria-hidden />
);

export function ApexChartLoader({ suspenseFallback, ...chartProps }: ApexChartLoaderProps) {
  return (
    <Suspense fallback={suspenseFallback ?? defaultFallback}>
      <ReactApexChart {...chartProps} />
    </Suspense>
  );
}
