import type { DeliveryColumn } from "@/types/home";
import { cn } from "@/lib/cn";

type DeliveryCardProps = {
  column: DeliveryColumn;
  className?: string;
};

export function DeliveryCard({ column, className }: DeliveryCardProps) {
  return (
    <article
      className={cn(
        "relative flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm",
        column.badge && "ring-1 ring-brand/20",
        className,
      )}
    >
      {column.badge ? (
        <span className="absolute right-5 top-5 rounded-full bg-brand-muted px-3 py-1 text-xs font-semibold text-brand">
          {column.badge}
        </span>
      ) : null}
      <h3
        className={cn(
          "text-xl font-semibold text-neutral-900",
          column.badge && "pr-24",
        )}
      >
        {column.title}
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        {column.description}
      </p>
      <ul className="mt-6 flex flex-col gap-3 text-sm text-neutral-700">
        {column.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              aria-hidden
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
