import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import {
  buildChatsGeoChartOptions,
  isoCountryCodeFromGeoChartRegion,
  type GeoChartDataTable,
} from './chatsGeoChart.util';
import {
  ensureGoogleGeoChartLoaded,
  getGoogleVisualization,
  isGoogleGeoChartLoadSettled,
  type GeoChartInstance,
  type GeoChartRegionEvent,
} from './chatsGeoChartLoader';

type LoadState = 'loading' | 'ready' | 'error';

type Props = {
  data: GeoChartDataTable;
  hasData: boolean;
  height: number;
  loader: ReactNode;
  errorElement: ReactNode;
  /** Fired when the pointer hovers a country region on the map (ISO code or null). */
  onRegionHover?: (countryCode: string | null) => void;
};

/**
 * Renders GeoChart via the Google Visualization API directly (no react-google-charts).
 * Avoids ChartWrapper/Dashboard lifecycle that can clear the map after first paint.
 */
export function ChatsGeoChart({ data, hasData, height, loader, errorElement, onRegionHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<GeoChartInstance | null>(null);
  const onRegionHoverRef = useRef(onRegionHover);
  onRegionHoverRef.current = onRegionHover;

  const [loadState, setLoadState] = useState<LoadState>(() =>
    isGoogleGeoChartLoadSettled() ? 'ready' : 'loading',
  );

  const options = useMemo(() => buildChatsGeoChartOptions(hasData, height), [hasData, height]);

  useEffect(() => {
    if (isGoogleGeoChartLoadSettled()) {
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    ensureGoogleGeoChartLoaded()
      .then(() => {
        if (!cancelled) setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const el = containerRef.current;
    const viz = getGoogleVisualization();
    if (!el || !viz?.GeoChart) return;

    const dataTable = viz.arrayToDataTable(data);
    if (!chartRef.current) {
      chartRef.current = new viz.GeoChart(el);
    }
    const chart = chartRef.current;
    chart.draw(dataTable, options);

    const events = viz.events;
    if (events && onRegionHoverRef.current) {
      events.removeAllListeners(chart);
      const onOver = (e: GeoChartRegionEvent) => {
        onRegionHoverRef.current?.(isoCountryCodeFromGeoChartRegion(e.region));
      };
      const onOut = () => onRegionHoverRef.current?.(null);
      events.addListener(chart, 'regionMouseOver', onOver);
      events.addListener(chart, 'regionMouseOut', onOut);
    }

    const onResize = () => {
      chart.draw(dataTable, options);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (events && chartRef.current) {
        events.removeAllListeners(chartRef.current);
      }
    };
  }, [loadState, data, options]);

  if (loadState === 'loading') {
    return <>{loader}</>;
  }
  if (loadState === 'error') {
    return <>{errorElement}</>;
  }

  return (
    <div ref={containerRef} className="min-w-0 w-full" style={{ height, minHeight: height }} />
  );
}
