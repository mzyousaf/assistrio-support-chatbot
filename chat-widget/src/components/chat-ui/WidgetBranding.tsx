import React from "react";

import { cx } from "./utils";

export type WidgetBrandingProps = {
  message: string;
  dark?: boolean;
  className?: string;
};

export function WidgetBranding({ message, dark = true, className }: WidgetBrandingProps) {
  const text = message.trim();
  if (!text) return null;

  return (
    <p className={cx("text-xs font-normal", dark ? "text-gray-500" : "text-gray-400", className)}>{text}</p>
  );
}
