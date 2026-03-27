"use client";

import React, { useRef, useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { cx } from "./utils";

export interface ChatMenuQuickLink {
  text: string;
  route: string;
}

export interface ChatHeaderProps {
  /** Dark theme (default true) */
  dark?: boolean;
  /** Back button click; omit to hide */
  onBack?: () => void;
  /** Show back button (default false). When false, back button is hidden even if onBack is set. */
  showBackButton?: boolean;
  /** Show avatar in header (default true). When false, avatar area is hidden. */
  showAvatar?: boolean;
  /** Avatar (image URL, emoji, or React node) */
  avatar?: React.ReactNode;
  /** Bot/chat name */
  title?: string;
  /** Subtitle under title */
  subtitle?: string;
  /** Status indicator: "live" | "active" | "none". When "none", no indicator is shown. */
  statusIndicator?: "live" | "active" | "none";
  /** "label" = dot + label text next to title; "dot-only" = dot overlapping avatar */
  liveIndicatorStyle?: "label" | "dot-only";
  /** "blinking" = animate-pulse; "static" = no animation (default "blinking") */
  statusDotStyle?: "blinking" | "static";
  /** Menu button click (legacy: no dropdown); omit if using menu items below */
  onMenu?: () => void;
  /** Show "Expand chat" option in menu dropdown */
  showMenuExpand?: boolean;
  /** Called when user chooses Expand chat */
  onMenuExpand?: () => void;
  /** Label for expand option (default "Expand chat") */
  expandLabel?: string;
  /** When true, expand option shows collapse icon/label */
  isExpanded?: boolean;
  /** Quick links in menu (max 3): text + route */
  menuQuickLinks?: ChatMenuQuickLink[];
  /** Close button click; omit to hide */
  onClose?: () => void;
  /** Back button label */
  backLabel?: string;
  /** Close button label */
  closeLabel?: string;
  /** Menu button label */
  menuLabel?: string;
  /** Label for "Live" status (e.g. "Live") */
  liveLabel?: string;
  /** Label for "Active" status (e.g. "Active") */
  activeLabel?: string;
  className?: string;
}

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
/** Expand: corner brackets pointing out (enlarge) */
const ExpandIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </svg>
);
/** Collapse: arrows pointing inward (opposite of expand) */
const CollapseIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 6L10 14M6 18L14 10" />
  </svg>
);

/** Status pill on avatar: small green dot; optional blink */
const StatusPill = ({
  dark = true,
  blinking = true,
}: {
  dark?: boolean;
  blinking?: boolean;
}) => (
  <span
    className={cx(
      "absolute bottom-0 right-0 h-2 w-2 rounded-full ring-1 bg-emerald-500",
      blinking && "animate-pulse",
      dark ? "ring-gray-900" : "ring-white"
    )}
    aria-hidden
  />
);

export function ChatHeader({
  dark = true,
  onBack,
  showBackButton = false,
  showAvatar = true,
  avatar,
  title,
  subtitle,
  statusIndicator = "none",
  liveIndicatorStyle = "label",
  statusDotStyle = "blinking",
  onMenu,
  showMenuExpand = false,
  onMenuExpand,
  expandLabel = "Expand chat",
  isExpanded = false,
  menuQuickLinks,
  onClose,
  backLabel = "Back",
  closeLabel = "Close",
  menuLabel = "Menu",
  liveLabel = "Live",
  activeLabel = "Active",
  className,
}: ChatHeaderProps) {
  const showStatus = statusIndicator === "live" || statusIndicator === "active";
  const showStatusPillOnAvatar = showAvatar && showStatus && liveIndicatorStyle === "dot-only";
  const showStatusLabel = showStatus && liveIndicatorStyle === "label";
  const statusLabel = statusIndicator === "active" ? activeLabel : liveLabel;
  const dotBlinking = statusDotStyle !== "static";

  const hasMenuDropdown = showMenuExpand || (menuQuickLinks && menuQuickLinks.length > 0);
  const showMenuButton = hasMenuDropdown || onMenu;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleMenuClick = () => {
    if (hasMenuDropdown) setMenuOpen((o) => !o);
    else onMenu?.();
  };

  const links = menuQuickLinks ?? [];

  return (
    <header
      className={cx(
        "flex-shrink-0 flex items-center gap-3 border-b px-4 py-3",
        dark ? "border-gray-700 bg-gray-900/50" : "border-gray-200 bg-gray-50",
        className
      )}
      aria-label="Chat header"
    >
      {showBackButton && onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={cx(
            "flex-shrink-0 rounded-lg p-2 transition-colors",
            dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          )}
          aria-label={backLabel}
        >
          <BackIcon />
        </button>
      ) : null}
      {showAvatar ? (
        <div
          className="flex-shrink-0 relative w-10 h-10"
          {...(showStatusPillOnAvatar && { role: "status" as const, "aria-label": statusLabel })}
        >
          <div
            className={cx(
              "w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-lg border-[1px]",
              dark ? "bg-gray-700/80 border-gray-600/80" : "bg-gray-100 border-gray-200"
            )}
          >
            {avatar != null ? (
              typeof avatar === "string" && (avatar.startsWith("http") || avatar.startsWith("/")) ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                avatar
              )
            ) : (
              <Bot className={cx("w-6 h-6 flex-shrink-0", dark ? "text-gray-400" : "text-gray-500")} aria-hidden />
            )}
          </div>
          {showStatusPillOnAvatar ? (
            <StatusPill dark={dark} blinking={dotBlinking} />
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {title ? (
            <h2 className={cx("text-sm font-semibold truncate", dark ? "text-gray-100" : "text-gray-900")}>
              {title}
            </h2>
          ) : null}
          {showStatusLabel ? (
            <span className="flex items-center gap-1.5 flex-shrink-0" role="status" aria-label={statusLabel}>
              <span
                className={cx(
                  "h-2 w-2 rounded-full ring-1 flex-shrink-0 bg-emerald-500",
                  dotBlinking && "animate-pulse",
                  dark ? "ring-gray-900" : "ring-white"
                )}
              />
              <span className={cx("text-xs font-medium", dark ? "text-emerald-400" : "text-emerald-600")}>
                {statusLabel}
              </span>
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <p className={cx("text-xs truncate mt-0.5", dark ? "text-gray-400" : "text-gray-500")}>{subtitle}</p>
        ) : null}
      </div>
      {showMenuButton ? (
        <div className="flex-shrink-0 relative" ref={menuRef}>
          <button
            type="button"
            onClick={handleMenuClick}
            className={cx(
              "rounded-lg p-2 transition-colors",
              dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            )}
            aria-label={menuLabel}
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <MenuIcon />
          </button>
          {hasMenuDropdown && menuOpen ? (
            <div
              className={cx(
                "absolute right-0 top-full mt-1 min-w-[160px] max-w-[220px] rounded-lg border py-1 shadow-xl z-50",
                dark ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"
              )}
              role="menu"
            >
              {showMenuExpand && onMenuExpand ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onMenuExpand();
                    setMenuOpen(false);
                  }}
                  className={cx(
                    "flex w-full items-center gap-2 px-4 py-2 text-left text-sm min-w-0",
                    dark ? "text-gray-200 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-100"
                  )}
                >
                  {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                  <span className="truncate">{expandLabel}</span>
                </button>
              ) : null}
              {links.map((item, i) => (
                <a
                  key={i}
                  href={item.route}
                  role="menuitem"
                  className={cx(
                    "flex w-full items-center gap-2 px-4 py-2 text-left text-sm min-w-0",
                    dark ? "text-gray-200 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-100"
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className="truncate min-w-0">{item.text}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className={cx(
            "flex-shrink-0 rounded-lg p-2 transition-colors",
            dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
          )}
          aria-label={closeLabel}
        >
          <CloseIcon />
        </button>
      ) : null}
    </header>
  );
}
