import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SecondarySidebarSection = {
  label?: string;
  items: ReactNode;
};

export type SecondarySidebarProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  sections?: SecondarySidebarSection[];
  className?: string;
  /** Hide on small screens (content stacks above). */
  hideOnMobile?: boolean;
};

export function SecondarySidebar({
  title,
  subtitle,
  children,
  sections,
  className,
  hideOnMobile = true,
}: SecondarySidebarProps) {
  return (
    <aside
      className={cn(
        'flex w-[var(--secondary-sidebar-width,13.5rem)] shrink-0 flex-col border-r border-[var(--border-sidebar)] bg-[var(--bg-sidebar-primary)]',
        hideOnMobile && 'hidden lg:flex',
        className,
      )}
      aria-label={`${title} navigation`}
    >
      <div className="border-b border-[var(--border-soft)] px-4 py-4">
        <h2 className="m-0 text-[0.8125rem] font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="m-0 mt-1 text-[0.75rem] leading-snug text-slate-500">{subtitle}</p> : null}
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {sections?.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className="flex flex-col gap-0.5">
            {section.label ? (
              <p className="m-0 px-3 pb-1 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </p>
            ) : null}
            {section.items}
          </div>
        ))}
        {children}
      </nav>
    </aside>
  );
}
