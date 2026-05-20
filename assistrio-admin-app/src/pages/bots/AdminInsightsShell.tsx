import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const INSIGHTS_NAV = [{ segment: 'conversations', label: 'Conversations', end: true }] as const;

/** Sub-nav under bot editor Insights tab (conversations only for Phase 7). */
export function AdminInsightsShell() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <nav
        className="flex flex-wrap gap-1 border-b border-slate-200/80 pb-0"
        aria-label="Insights sections"
      >
        {INSIGHTS_NAV.map(({ segment, label, end }) => (
          <NavLink
            key={segment}
            to={segment}
            end={end}
            className={({ isActive }) =>
              cn(
                'rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border border-b-white border-slate-200/80 bg-white text-teal-800'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
