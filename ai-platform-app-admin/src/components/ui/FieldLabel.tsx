"use client";

import React from "react";

import InfoIcon from "@/components/ui/InfoIcon";
import Tooltip from "@/components/ui/Tooltip";

interface FieldLabelProps {
  label: string;
  hint?: string;
}

export default function FieldLabel({ label, hint }: FieldLabelProps) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
      <span>{label}</span>
      {hint ? (
        <Tooltip content={hint}>
          <button
            type="button"
            aria-label={`${label} info`}
            className="inline-flex items-center rounded focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <InfoIcon />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
