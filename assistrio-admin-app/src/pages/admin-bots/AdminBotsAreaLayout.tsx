import { Outlet } from 'react-router-dom';
import { ContextualMain } from '@/layout/ContextualMain';

/** Admin bots list, create, and detail — single primary nav link to `/admin-bots`. */
export function AdminBotsAreaLayout() {
  return (
    <ContextualMain>
      <Outlet />
    </ContextualMain>
  );
}
