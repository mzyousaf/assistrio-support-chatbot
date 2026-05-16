import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge default theme omits app tokens from `@theme` (e.g. `primary`).
 * Without this, merged class strings can drop `border-primary`, `text-primary`, etc.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['primary', 'primary-foreground'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
