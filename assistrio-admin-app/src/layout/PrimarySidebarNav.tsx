import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FollowingSubNavTrack, useFollowingSubNavIndicator } from '@/layout/FollowingSubNavTrack';
import { cn } from '@/lib/utils';
import {
  isPrimaryNavChildActive,
  isPrimaryNavEntryActive,
  PRIMARY_NAV,
  type PrimaryNavEntry,
  type PrimaryNavGroup,
} from './primaryNav';

const parentBtnCls = (active: boolean, collapsed: boolean) =>
  cn(
    'group relative flex w-full cursor-pointer items-center rounded-md border-none bg-transparent text-left text-[0.8125rem] font-medium transition-[background-color,color] duration-150',
    collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-[0.4375rem]',
    active
      ? 'bg-[var(--active-soft)] font-semibold text-[var(--active-text)]'
      : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
  );

const subNavCls = (active: boolean) =>
  cn(
    'group relative flex items-center gap-2 rounded-md py-[0.375rem] pl-2.5 pr-2 text-[0.8125rem] font-medium no-underline transition-[background-color,color] duration-150',
    active
      ? 'bg-[var(--active-soft)] font-semibold text-[var(--active-text)]'
      : 'text-slate-500 hover:bg-[var(--hover-soft)] hover:text-slate-900',
  );

const linkCls = (active: boolean, collapsed: boolean) =>
  cn(
    'group relative flex items-center rounded-md text-[0.8125rem] font-medium no-underline transition-[background-color,color] duration-150',
    collapsed ? 'justify-center p-2' : 'gap-2.5 px-2.5 py-[0.4375rem]',
    active
      ? 'bg-[var(--active-soft)] font-semibold text-[var(--active-text)]'
      : 'text-slate-600 hover:bg-[var(--hover-soft)] hover:text-slate-900',
  );

function iconCls(active: boolean) {
  return cn(
    'shrink-0 transition-colors duration-150',
    active ? 'text-[var(--teal-600)]' : 'text-slate-400 group-hover:text-[var(--teal-600)]',
  );
}

function PrimaryNavGroupItems({
  entry,
  collapsePrimary,
}: {
  entry: PrimaryNavGroup;
  collapsePrimary: boolean;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const groupActive = isPrimaryNavEntryActive(entry, pathname);
  const [open, setOpen] = useState(() => groupActive);
  const Icon = entry.icon;

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive, pathname]);

  const showChildren = !collapsePrimary && (open || groupActive);
  const activeChildIndex = entry.children.findIndex((child) => isPrimaryNavChildActive(child, pathname));
  const { trackRef, setItemRef, indicator } = useFollowingSubNavIndicator(
    collapsePrimary ? -1 : activeChildIndex,
    [pathname, showChildren, entry.id, collapsePrimary],
  );

  if (collapsePrimary) {
    return (
      <NavLink
        to={entry.defaultTo}
        title={entry.label}
        className={linkCls(groupActive, true)}
        aria-current={groupActive ? 'page' : undefined}
      >
        <Icon size={17} strokeWidth={1.75} className={iconCls(groupActive)} aria-hidden />
        <span className="sr-only">{entry.label}</span>
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        className={parentBtnCls(groupActive, false)}
        aria-expanded={showChildren}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && !groupActive) navigate(entry.defaultTo);
        }}
      >
        <Icon size={17} strokeWidth={1.75} className={iconCls(groupActive)} aria-hidden />
        <span className="flex-1 truncate text-left">{entry.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={cn('shrink-0 text-slate-300 transition-transform duration-200', showChildren && 'rotate-180')}
          aria-hidden
        />
      </button>
      {showChildren ? (
        <FollowingSubNavTrack trackRef={trackRef} indicator={indicator}>
          {entry.children.map((child, i) => {
            const childActive = isPrimaryNavChildActive(child, pathname);
            const ChildIcon = child.icon;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                end={child.end ?? true}
                className={subNavCls(childActive)}
                ref={setItemRef(i)}
              >
                {ChildIcon ? (
                  <ChildIcon size={15} strokeWidth={1.75} className={iconCls(childActive)} aria-hidden />
                ) : null}
                {child.label}
              </NavLink>
            );
          })}
        </FollowingSubNavTrack>
      ) : null}
    </div>
  );
}

function PrimaryNavLinkItem({
  entry,
  collapsePrimary,
}: {
  entry: Extract<PrimaryNavEntry, { kind: 'link' }>;
  collapsePrimary: boolean;
}) {
  const { pathname } = useLocation();
  const active = entry.isActive ? entry.isActive(pathname) : pathname === entry.to || pathname.startsWith(`${entry.to}/`);
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      title={entry.label}
      className={linkCls(active, collapsePrimary)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={17} strokeWidth={1.75} className={iconCls(active)} aria-hidden />
      {!collapsePrimary ? <span>{entry.label}</span> : <span className="sr-only">{entry.label}</span>}
    </NavLink>
  );
}

export function PrimarySidebarNav({ collapsePrimary }: { collapsePrimary: boolean }) {
  return (
    <nav className="flex flex-col gap-1 p-2" aria-label="Admin navigation">
      {PRIMARY_NAV.map((entry) =>
        entry.kind === 'group' ? (
          <PrimaryNavGroupItems key={entry.id} entry={entry} collapsePrimary={collapsePrimary} />
        ) : (
          <PrimaryNavLinkItem key={entry.to} entry={entry} collapsePrimary={collapsePrimary} />
        ),
      )}
    </nav>
  );
}
