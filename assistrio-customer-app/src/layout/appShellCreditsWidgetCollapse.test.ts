import { afterEach, describe, expect, it } from 'vitest';
import {
  APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY,
  defaultAppShellCreditsWidgetCollapsed,
  readAppShellCreditsWidgetCollapseState,
  resolveAppShellCreditsWidgetCollapsed,
  writeAppShellCreditsWidgetCollapsed,
} from '@/layout/appShellCreditsWidgetCollapse';

describe('appShellCreditsWidgetCollapse', () => {
  afterEach(() => {
    window.localStorage.removeItem(APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY);
  });

  it('defaults primary to expanded and agent to collapsed', () => {
    expect(defaultAppShellCreditsWidgetCollapsed('primary')).toBe(false);
    expect(defaultAppShellCreditsWidgetCollapsed('agent')).toBe(true);
    expect(resolveAppShellCreditsWidgetCollapsed('primary')).toBe(false);
    expect(resolveAppShellCreditsWidgetCollapsed('agent')).toBe(true);
  });

  it('persists collapsed state for the primary sidebar only', () => {
    writeAppShellCreditsWidgetCollapsed(true);

    expect(readAppShellCreditsWidgetCollapseState()).toEqual({
      primary: true,
    });
    expect(resolveAppShellCreditsWidgetCollapsed('primary')).toBe(true);
    expect(resolveAppShellCreditsWidgetCollapsed('agent')).toBe(true);
  });

  it('always collapses on the agent sidebar even when legacy agent preference exists', () => {
    window.localStorage.setItem(
      APP_SHELL_CREDITS_WIDGET_COLLAPSE_STORAGE_KEY,
      JSON.stringify({ primary: false, agent: false }),
    );

    expect(resolveAppShellCreditsWidgetCollapsed('primary')).toBe(false);
    expect(resolveAppShellCreditsWidgetCollapsed('agent')).toBe(true);
  });
});
