import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { ContextualAreaShell } from '@/layout/ContextualAreaShell';
import { ContextualMain } from '@/layout/ContextualMain';
import { MobileContextNav, type MobileContextNavItem } from '@/layout/MobileContextNav';
import { SecondarySidebar } from '@/layout/SecondarySidebar';
import { SecondarySidebarNavItem, type SecondarySidebarNavItemProps } from '@/layout/SecondarySidebarNavItem';

type Props = {
  title: string;
  subtitle?: string;
  navItems: SecondarySidebarNavItemProps[];
  mobileAriaLabel: string;
  /** When false, only padded main content (primary submenu is enough on list pages). */
  showSecondary?: boolean;
  children?: ReactNode;
};

export function ContextualAreaLayout({
  title,
  subtitle,
  navItems,
  mobileAriaLabel,
  showSecondary = true,
  children,
}: Props) {
  const mobileItems: MobileContextNavItem[] = navItems.map(({ to, label, end, icon }) => ({
    to,
    label,
    end,
    icon,
  }));

  if (!showSecondary) {
    return <ContextualMain>{children ?? <Outlet />}</ContextualMain>;
  }

  return (
    <ContextualAreaShell
      sidebar={
        <SecondarySidebar title={title} subtitle={subtitle}>
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => (
              <SecondarySidebarNavItem key={item.to} {...item} />
            ))}
          </div>
        </SecondarySidebar>
      }
    >
      <MobileContextNav items={mobileItems} ariaLabel={mobileAriaLabel} />
      <ContextualMain>{children ?? <Outlet />}</ContextualMain>
    </ContextualAreaShell>
  );
}
