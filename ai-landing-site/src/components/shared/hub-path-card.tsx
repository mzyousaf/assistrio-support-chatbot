import { ButtonLink } from "@/components/shared/button-link";
import type { AiSupportsPathCardContent } from "@/types/ai-supports";
import { cn } from "@/lib/cn";

type HubPathCardProps = {
  content: AiSupportsPathCardContent;
  emphasized?: boolean;
  className?: string;
};

function resolveButtonVariant(
  v: AiSupportsPathCardContent["primaryCta"]["variant"],
  fallback: "primary" | "secondary" | "ghost",
) {
  if (v === "ghost") return "ghost";
  if (v === "secondary") return "secondary";
  if (v === "primary") return "primary";
  return fallback;
}

export function HubPathCard({
  content,
  emphasized = false,
  className,
}: HubPathCardProps) {
  const primaryVariant = resolveButtonVariant(
    content.primaryCta.variant,
    "primary",
  );

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-sm transition md:p-8",
        emphasized &&
          "border-brand/35 bg-gradient-to-br from-brand-muted/70 to-white ring-1 ring-brand/15",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        {content.kicker}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl">
        {content.title}
      </h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-600 sm:text-base">
        {content.description}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <ButtonLink
          href={content.primaryCta.href}
          label={content.primaryCta.label}
          variant={primaryVariant}
        />
        {content.secondaryCta ? (
          <ButtonLink
            href={content.secondaryCta.href}
            label={content.secondaryCta.label}
            variant={resolveButtonVariant(
              content.secondaryCta.variant,
              "secondary",
            )}
          />
        ) : null}
      </div>
    </article>
  );
}
