import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { FollowingSubNavTrack, useFollowingSubNavIndicator } from '@/layout/FollowingSubNavTrack';
import { cn } from '@/lib/utils';

export type SecondarySidebarNavChild = {
  to: string;
  label: string;
  end?: boolean;
};

export type SecondarySidebarNavItemProps = {
  to: string;
  label: string;
  end?: boolean;
  icon?: LucideIcon;
  badge?: string | number;
  description?: string;
  children?: SecondarySidebarNavChild[];
};

function childActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SecondarySidebarNavItem({
  to,
  label,
  end,
  icon: Icon,
  badge,
  description,
  children,
}: SecondarySidebarNavItemProps) {
  const { pathname } = useLocation();
  const parentActive =
    childActive(pathname, to, end) ||
    (children?.some((c) => childActive(pathname, c.to, c.end)) ?? false);
  const knowledgeOpen = parentActive;
  const activeChildIndex =
    children?.findIndex((c) => childActive(pathname, c.to, c.end)) ?? -1;
  const { trackRef, setItemRef, indicator } = useFollowingSubNavIndicator(
    knowledgeOpen ? activeChildIndex : -1,
    [pathname, knowledgeOpen, to],
  );

  if (!children?.length) {
    return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'flex items-start gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium no-underline transition-colors',
            isActive
              ? 'bg-[var(--active-soft)] text-[var(--active-text)]'
              : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
          )
        }
      >
        {Icon ? <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0 opacity-80" aria-hidden /> : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate">{label}</span>
            {badge != null && badge !== '' ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-slate-600">
                {badge}
              </span>
            ) : null}
          </span>
          {description ? (
            <span className="mt-0.5 block text-[0.6875rem] font-normal leading-snug text-slate-500">{description}</span>
          ) : null}
        </span>
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <NavLink
        to={to}
        end={end}
        className={cn(
          'flex items-start gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium no-underline transition-colors',
          parentActive
            ? 'bg-[var(--active-soft)] text-[var(--active-text)]'
            : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
        )}
      >
        {Icon ? <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0 opacity-80" aria-hidden /> : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </NavLink>
      {knowledgeOpen ? (
        <FollowingSubNavTrack className="ml-1 mt-0.5" trackRef={trackRef} indicator={indicator}>
          {children.map((child, i) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              ref={setItemRef(i)}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-[var(--active-soft)] text-[var(--active-text)]'
                    : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </FollowingSubNavTrack>
      ) : null}
    </div>
  );
}
