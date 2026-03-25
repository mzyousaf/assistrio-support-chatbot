import type { HowItWorksStep } from "@/types/home";
import { cn } from "@/lib/cn";

type StepListProps = {
  steps: HowItWorksStep[];
  className?: string;
};

export function StepList({ steps, className }: StepListProps) {
  return (
    <ol
      className={cn(
        "grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6",
        className,
      )}
    >
      {steps.map((step, index) => (
        <li key={step.title} className="relative flex gap-4 lg:block lg:pt-0">
          <div className="flex shrink-0 flex-col items-center lg:mb-4 lg:flex-row lg:items-center lg:gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow-sm"
              aria-hidden
            >
              {index + 1}
            </span>
            {index < steps.length - 1 ? (
              <span
                className="hidden h-px flex-1 bg-gradient-to-r from-brand/40 to-transparent lg:ml-2 lg:block lg:min-w-[1rem]"
                aria-hidden
              />
            ) : null}
          </div>
          <div className="min-w-0 lg:pl-0">
            <h3 className="text-base font-semibold text-neutral-900">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {step.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
