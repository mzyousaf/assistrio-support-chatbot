import { Outlet } from 'react-router-dom';
import { ContextualMain } from '@/layout/ContextualMain';

/** Insights subnav lives in the primary sidebar (customer Settings pattern) — no secondary sidebar. */
export function AdminInsightsLayout() {
  return (
    <ContextualMain>
      <Outlet />
    </ContextualMain>
  );
}
