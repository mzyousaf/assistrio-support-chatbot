"use client";

import { useId, useState } from "react";
import type { FaqItem } from "@/types/home";
import { cn } from "@/lib/cn";

type FaqAccordionProps = {
  items: FaqItem[];
  className?: string;
};

export function FaqAccordion({ items, className }: FaqAccordionProps) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div
      className={cn(
        "divide-y divide-neutral-200 rounded-2xl border border-neutral-200/90 bg-white px-1 shadow-sm",
        className,
      )}
    >
      {items.map((item, index) => {
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;
        const isOpen = openIndex === index;

        return (
          <div key={item.question} className="px-4 py-1">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold text-neutral-900 transition hover:text-brand"
              >
                <span className="pr-2">{item.question}</span>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-brand transition",
                    isOpen && "rotate-180 border-brand/30 bg-brand-muted/50",
                  )}
                  aria-hidden
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className={cn(!isOpen && "hidden")}
            >
              <p className="pb-5 pl-0 pr-10 text-sm leading-relaxed text-neutral-600">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
