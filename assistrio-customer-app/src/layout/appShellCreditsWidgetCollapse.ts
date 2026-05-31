import { useCallback, useEffect, useState } from 'react';

export const APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY =
  'assistrio_credits_widget_collapse_v1';

export type AppShellCreditsWidgetCollapseContext = 'primary' | 'agent';

export type AppShellCreditsWidgetCollapseState = {
  primary?: boolean;
};

export function defaultAppShellCreditsWidgetCollapsed(
  context: AppShellCreditsWidgetCollapseContext,
): boolean {
  return context === 'agent';
}

export function readAppShellCreditsWidgetCollapseState(): AppShellCreditsWidgetCollapseState {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};

    const record = parsed as Record<string, unknown>;
    const state: AppShellCreditsWidgetCollapseState = {};

    if (typeof record.primary === 'boolean') state.primary = record.primary;

    return state;
  } catch {
    return {};
  }
}

export function resolveAppShellCreditsWidgetCollapsed(
  context: AppShellCreditsWidgetCollapseContext,
  state: AppShellCreditsWidgetCollapseState = readAppShellCreditsWidgetCollapseState(),
): boolean {
  if (context === 'agent') {
    return defaultAppShellCreditsWidgetCollapsed('agent');
  }

  const stored = state.primary;
  if (typeof stored === 'boolean') return stored;
  return defaultAppShellCreditsWidgetCollapsed('primary');
}

export function writeAppShellCreditsWidgetCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY,
    JSON.stringify({ primary: collapsed } satisfies AppShellCreditsWidgetCollapseState),
  );
}

export function useAppShellCreditsWidgetCollapsed(context: AppShellCreditsWidgetCollapseContext) {
  const [collapsed, setCollapsed] = useState(() =>
    resolveAppShellCreditsWidgetCollapsed(context),
  );

  useEffect(() => {
    setCollapsed(resolveAppShellCreditsWidgetCollapsed(context));
  }, [context]);

  const setCollapsedPersisted = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      if (context === 'primary') {
        writeAppShellCreditsWidgetCollapsed(next);
      }
    },
    [context],
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsedPersisted(!collapsed);
  }, [collapsed, setCollapsedPersisted]);

  return { collapsed, toggleCollapsed, setCollapsed: setCollapsedPersisted };
}
