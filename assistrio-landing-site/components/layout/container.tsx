import type { ReactNode } from "react";

const maxWidthClass = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  prose: "max-w-2xl",
  /** Short form pages (contact, confirmations) */
  compact: "max-w-xl",
  wide: "max-w-7xl",
} as const;

export type ContainerSize = keyof typeof maxWidthClass;

type Props = {
  children: ReactNode;
  className?: string;
  /** Default marketing width; `narrow` for forms/long copy; `prose` for contact/legal; `wide` for dense grids */
  size?: ContainerSize;
};

export function Container({ children, className = "", size = "default" }: Props) {
  return (
    <div
      className={`mx-auto w-full min-w-0 px-4 sm:px-6 lg:px-8 ${maxWidthClass[size]} ${className}`}
    >
      {children}
    </div>
  );
}
