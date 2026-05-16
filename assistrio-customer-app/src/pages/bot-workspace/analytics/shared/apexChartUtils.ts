import type { ApexOptions } from 'apexcharts';
import { APEX } from './apexAnalyticsTheme';

export function apexChartBase(): Pick<ApexOptions, 'chart' | 'colors'> {
  return {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      animations: { enabled: true },
    },
  };
}

export function apexGrid(): ApexOptions['grid'] {
  return {
    borderColor: APEX.grid,
    strokeDashArray: 0,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 4, right: 8 },
  };
}

export function apexLegendBottom(): ApexOptions['legend'] {
  return {
    show: true,
    position: 'bottom',
    horizontalAlign: 'center',
    fontSize: '11px',
    fontWeight: 500,
    markers: { size: 4, strokeWidth: 0 },
    labels: { colors: APEX.axis },
  };
}

export function apexXAxisCategories(categories: string[], rotate = -35): ApexOptions['xaxis'] {
  return {
    categories,
    labels: {
      rotate,
      rotateAlways: categories.length > 8,
      style: { colors: APEX.axis, fontSize: '10px' },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
  };
}

export function apexYAxisInteger(
  min = 0,
  labelFormatter?: (val: number) => string,
): ApexOptions['yaxis'] {
  return {
    min,
    labels: {
      style: { colors: APEX.axis, fontSize: '11px' },
      formatter: labelFormatter,
    },
  };
}
