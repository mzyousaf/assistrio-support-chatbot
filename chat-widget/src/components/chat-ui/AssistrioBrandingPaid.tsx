import React from "react";

import assistrioLogo from "../../icons/logo.png";
import { footerBrandingTextClass, cx } from "./utils";

const ASSISTRIO_HOME_URL = "https://assistrio.com";

export type AssistrioBrandingPaidProps = {
  dark?: boolean;
  compact?: boolean;
  className?: string;
};

export function AssistrioBrandingPaid({
  dark = true,
  compact = false,
  className,
}: AssistrioBrandingPaidProps) {
  return (
    <div
      className={cx(
        "flex w-full shrink-0 justify-center text-center",
        compact ? "px-2 py-3.5" : "px-3 py-4",
        className,
      )}
    >
      <a
        href={ASSISTRIO_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Powered by Assistrio — visit assistrio.com"
        className={cx(
          "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
          footerBrandingTextClass(dark),
          "focus-visible:ring-gray-500/60",
          dark ? "focus-visible:ring-gray-600" : "focus-visible:ring-gray-300",
        )}
      >
        <img
          src={assistrioLogo}
          alt=""
          className="h-4 w-4 shrink-0 object-contain"
          aria-hidden
        />
        <span className="text-xs font-semibold">Powered by Assistrio</span>
      </a>
    </div>
  );
}
