import { Outlet } from 'react-router-dom';
import { ContextualMain } from '@/layout/ContextualMain';

/** Settings subnav lives in the primary sidebar (customer Settings pattern) — no secondary sidebar. */
export function AdminSettingsLayout() {
  return (
    <ContextualMain>
      <Outlet />
    </ContextualMain>
  );
}
