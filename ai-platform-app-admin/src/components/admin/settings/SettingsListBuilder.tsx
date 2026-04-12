"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { SettingsEmptyState } from "./SettingsEmptyState";

export interface SettingsListBuilderProps {
  /** Number of items; when 0, empty state is shown */
  itemCount: number;
  /** Title for empty state */
  emptyTitle: string;
  /** Short description for empty state */
  emptyDescription?: string;
  /** Label for the add button */
  addLabel: string;
  onAdd: () => void;
  /** Max items; add button hidden when at max */
  maxItems?: number;
  /** When true, add button is disabled (e.g. parent section disabled) */
  addDisabled?: boolean;
  /** List content (item cards) */
  children: React.ReactNode;
  className?: string;
}

export function SettingsListBuilder({
  itemCount,
  emptyTitle,
  emptyDescription,
  addLabel,
  onAdd,
  maxItems,
  addDisabled = false,
  children,
  className = "",
}: SettingsListBuilderProps) {
  const showEmpty = itemCount === 0;
  const canAdd = maxItems == null || itemCount < maxItems;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {showEmpty ? (
        <SettingsEmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={addDisabled}
              onClick={onAdd}
            >
              {addLabel}
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">{children}</div>
          {canAdd ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={addDisabled}
              onClick={onAdd}
            >
              {addLabel}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
