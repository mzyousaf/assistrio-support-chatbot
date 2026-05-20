import type { LucideIcon } from 'lucide-react';
import { SecondarySidebarNavItem } from './SecondarySidebarNavItem';

export type MobileContextNavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon?: LucideIcon;
};

export function MobileContextNav({ items, ariaLabel }: { items: MobileContextNavItem[]; ariaLabel: string }) {
  return (
    <nav
      className="border-b border-[var(--border-soft)] bg-white lg:hidden"
      aria-label={ariaLabel}
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch]">
        {items.map((item) => (
          <div key={item.to} className="shrink-0">
            <SecondarySidebarNavItem {...item} />
          </div>
        ))}
      </div>
    </nav>
  );
}
