"use client";

import type { RefObject, ReactNode } from "react";

type Props = {
  id: string;
  inputId: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  children: ReactNode;
  className?: string;
};

/**
 * Accessible file picker: visible tile (`children`) + hidden file input.
 */
export function TrialUploadField({ id, inputId, inputRef, label, description, accept = "image/*", disabled, onFileChange, children, className = "" }: Props) {
  return (
    <div id={id} className={className}>
      <label htmlFor={inputId} className="block cursor-pointer">
        <span className="sr-only">
          {label}
          {description ? ` — ${description}` : ""}
        </span>
        {children}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFileChange(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
