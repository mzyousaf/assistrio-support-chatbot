/** Packages required for GeoChart (corechart supplies shared visualization APIs). */
export const CHATS_GEO_CHART_PACKAGES = ['corechart', 'geochart'] as const;

const LOADER_SCRIPT_URL = 'https://www.gstatic.com/charts/loader.js';

type GoogleChartsWindow = typeof window & {
  google?: {
    charts?: {
      load: (version: string, opts: { packages: string[]; language?: string }) => void;
      setOnLoadCallback: (cb: () => void) => void;
    };
    visualization?: {
      GeoChart?: new (el: HTMLElement) => GeoChartInstance;
      arrayToDataTable: (data: unknown[][]) => unknown;
      events?: {
        addListener: (
          chart: GeoChartInstance,
          eventName: string,
          handler: (event: GeoChartRegionEvent) => void,
        ) => void;
        removeAllListeners: (chart: GeoChartInstance) => void;
      };
    };
  };
};

export type GeoChartRegionEvent = { region?: string };

export type GeoChartInstance = {
  draw: (data: unknown, options: Record<string, unknown>) => void;
};

function isGeoChartReady(): boolean {
  const g = (window as GoogleChartsWindow).google;
  return Boolean(g?.visualization?.GeoChart && g.visualization?.arrayToDataTable);
}

let loadPromise: Promise<void> | null = null;
let loadSettled = false;

/** True after a successful load (survives React Strict Mode remounts). */
export function isGoogleGeoChartLoadSettled(): boolean {
  return loadSettled || isGeoChartReady();
}

/** Idempotent loader for GeoChart — avoids react-google-charts double-load flicker. */
export function ensureGoogleGeoChartLoaded(): Promise<void> {
  if (isGeoChartReady()) {
    loadSettled = true;
    return Promise.resolve();
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      await loadScript();
      const g = (window as GoogleChartsWindow).google;
      if (!g?.charts) {
        throw new Error('Google Charts not available on window');
      }
      await new Promise<void>((resolve, reject) => {
        g.charts!.load('current', {
          packages: [...CHATS_GEO_CHART_PACKAGES],
          language: 'en',
        });
        g.charts!.setOnLoadCallback(() => {
          if (isGeoChartReady()) {
            loadSettled = true;
            resolve();
          } else {
            reject(new Error('Google GeoChart failed to initialize'));
          }
        });
      });
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${LOADER_SCRIPT_URL}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = LOADER_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Charts script'));
    document.head.append(script);
  });
}

export type GoogleVisualizationApi = NonNullable<GoogleChartsWindow['google']>['visualization'];

export function getGoogleVisualization(): GoogleVisualizationApi | null {
  return (window as GoogleChartsWindow).google?.visualization ?? null;
}
