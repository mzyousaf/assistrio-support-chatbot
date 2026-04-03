import React, { useRef, useState, useEffect } from "react";
import {
  Bot,
  History,
  LogOut,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  MoreVertical,
} from "lucide-react";
import { getQuickLinkIcon } from "../../lib/quickLinkIcons";
import { cx } from "./utils";

export interface ChatMenuQuickLink {
  text: string;
  route: string;
  icon?: string;
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
  /** Show "Expand chat" option in session menu dropdown */
  showMenuExpand?: boolean;
  /** Called when user chooses Expand chat */
  onMenuExpand?: () => void;
  /** Label for expand option (default "Expand chat") */
  expandLabel?: string;
  /** When true, expand option shows collapse icon/label */
  isExpanded?: boolean;
  /** Quick links (max 10): text + route — shown under a link icon, not the session menu */
  menuQuickLinks?: ChatMenuQuickLink[];
  /** When false, do not show the quick links control (default true). */
  showMenuQuickLinks?: boolean;
  /** Icon for the button that opens quick links (default link-2). */
  quickLinksMenuIcon?: string;
  /** Multi-chat: show Start new / End / Recent in the session (⋮) menu */
  showSessionMenu?: boolean;
  /** When false, hide “Start a new chat” (e.g. single-thread mode or at saved-thread cap). Default true when session menu is shown. */
  showSessionStartNew?: boolean;
  /** When false, hide “End chat”. Default true when session menu is shown. */
  showSessionEndChat?: boolean;
  /** When false, hide “View recent chats”. Default true when session menu is shown. */
  showSessionRecentChats?: boolean;
  onSessionStartNewChat?: () => void;
  onSessionEndChat?: () => void;
  /** When true, End chat is disabled (e.g. no user messages yet). */
  sessionEndChatDisabled?: boolean;
  /** When true, Start new chat is disabled (e.g. at saved-conversation cap). */
  sessionStartNewDisabled?: boolean;
  /** Opens full-screen chat history list (parent renders the list view). */
  onSessionOpenHistory?: () => void;
  /** Close button click; omit to hide */
  onClose?: () => void;
  /** Back button label */
  backLabel?: string;
  /** Close button label */
  closeLabel?: string;
  /** Legacy label for generic menu (rare) */
  menuLabel?: string;
  /** Accessible label for quick-links control */
  quickLinksMenuLabel?: string;
  /** Accessible label for session / chat-actions control */
  sessionMenuLabel?: string;
  startNewChatLabel?: string;
  endChatLabel?: string;
  recentChatsLabel?: string;
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
  showMenuQuickLinks = true,
  quickLinksMenuIcon,
  showSessionMenu = false,
  showSessionStartNew = true,
  showSessionEndChat = true,
  showSessionRecentChats = true,
  onSessionStartNewChat,
  onSessionEndChat,
  sessionEndChatDisabled = false,
  sessionStartNewDisabled = false,
  onSessionOpenHistory,
  onClose,
  backLabel = "Back",
  closeLabel = "Close",
  menuLabel = "Menu",
  quickLinksMenuLabel = "Quick links",
  sessionMenuLabel = "Chat actions",
  startNewChatLabel = "Start a new chat",
  endChatLabel = "End chat",
  recentChatsLabel = "View recent chats",
  liveLabel = "Live",
  activeLabel = "Active",
  className,
}: ChatHeaderProps) {
  const showStatus = statusIndicator === "live" || statusIndicator === "active";
  const showStatusPillOnAvatar = showAvatar && showStatus && liveIndicatorStyle === "dot-only";
  const showStatusLabel = showStatus && liveIndicatorStyle === "label";
  const statusLabel = statusIndicator === "active" ? activeLabel : liveLabel;
  const dotBlinking = statusDotStyle !== "static";

  const links = (menuQuickLinks ?? []).slice(0, 10);
  const hasQuickLinks = links.length > 0;
  const showQuickLinksButton = showMenuQuickLinks !== false && hasQuickLinks;
  const sessionMenuHasAnyItem =
    showSessionMenu &&
    (showSessionStartNew || showSessionEndChat || showSessionRecentChats);
  const hasSessionDropdown =
    (showMenuExpand && Boolean(onMenuExpand)) || Boolean(sessionMenuHasAnyItem);
  const legacyMenuOnly = Boolean(onMenu) && !showQuickLinksButton && !hasSessionDropdown;

  const [linksOpen, setLinksOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const linksRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!linksOpen && !sessionOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (linksRef.current && !linksRef.current.contains(t)) setLinksOpen(false);
      if (sessionRef.current && !sessionRef.current.contains(t)) {
        setSessionOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linksOpen, sessionOpen]);

  const menuBtnClass = cx(
    "rounded-lg p-2 transition-colors",
    dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
  );
  const dropdownClass = cx(
    "absolute right-0 top-full mt-1 min-w-[180px] max-w-[260px] rounded-lg border py-1 shadow-xl z-50",
    dark ? "border-gray-600 bg-gray-800" : "border-gray-200 bg-white"
  );
  const itemClass = cx(
    "flex w-full items-center gap-2 px-4 py-2 text-left text-sm min-w-0",
    dark ? "text-gray-200 hover:bg-gray-700" : "text-gray-800 hover:bg-gray-100"
  );
  const sessionItemDisabledClass = cx(
    "cursor-not-allowed opacity-50 hover:bg-transparent",
    dark ? "text-gray-500" : "text-gray-400",
  );
  const sessionIconClass = cx(
    "h-4 w-4 flex-shrink-0 opacity-90",
    dark ? "text-gray-300" : "text-gray-600"
  );
  const quickLinkGoIconClass = cx(
    "h-4 w-4 flex-shrink-0 opacity-70",
    dark ? "text-gray-400" : "text-gray-500"
  );
  const QuickLinksMenuButtonIcon = getQuickLinkIcon(quickLinksMenuIcon ?? "link-2");
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

      <div className="flex-shrink-0 flex items-center gap-1">
        {showQuickLinksButton ? (
          <div className="relative" ref={linksRef}>
            <button
              type="button"
              onClick={() => setLinksOpen((o) => !o)}
              className={menuBtnClass}
              aria-label={quickLinksMenuLabel}
              aria-expanded={linksOpen}
              aria-haspopup="true"
              title={quickLinksMenuLabel}
            >
              <QuickLinksMenuButtonIcon className="w-5 h-5" strokeWidth={2} aria-hidden />
            </button>
            {linksOpen ? (
              <div className={cx(dropdownClass, "overflow-visible")} role="menu">
                {links.map((item, i) => {
                  const tip =
                    item.text.trim() && item.route.trim()
                      ? `${item.text.trim()} — ${item.route.trim()}`
                      : item.route.trim() || item.text.trim();
                  const LinkGlyph = getQuickLinkIcon(item.icon);
                  return (
                    <div key={i} className="group/quicklink relative">
                      <a
                        href={item.route}
                        role="menuitem"
                        className={itemClass}
                        title={tip}
                        onClick={() => setLinksOpen(false)}
                      >
                        <LinkGlyph className={quickLinkGoIconClass} strokeWidth={2} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.text}</span>
                      </a>
                      <div
                        className={cx(
                          "pointer-events-none absolute left-1/2 bottom-full z-[60] mb-1.5 w-max max-w-[min(260px,calc(100vw-2rem))] -translate-x-1/2 rounded-md border px-2.5 py-1.5 text-left text-[11px] leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover/quicklink:opacity-100",
                          dark
                            ? "border-gray-600 bg-gray-950 text-gray-200"
                            : "border-gray-200 bg-white text-gray-800",
                        )}
                        role="tooltip"
                      >
                        <span className="block font-medium">{item.text}</span>
                        <span
                          className={cx(
                            "mt-0.5 block break-all opacity-90",
                            dark ? "text-gray-400" : "text-gray-600",
                          )}
                        >
                          {item.route}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasSessionDropdown ? (
          <div className="relative" ref={sessionRef}>
            <button
              type="button"
              onClick={() => setSessionOpen((o) => !o)}
              className={menuBtnClass}
              aria-label={sessionMenuLabel}
              aria-expanded={sessionOpen}
              aria-haspopup="true"
            >
              <MoreVertical className="w-5 h-5" strokeWidth={2} aria-hidden />
            </button>
            {sessionOpen ? (
              <div className={dropdownClass} role="menu">
                {showMenuExpand && onMenuExpand ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onMenuExpand();
                      setSessionOpen(false);
                    }}
                    className={itemClass}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-4 h-4 flex-shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
                    ) : (
                      <Maximize2 className="w-4 h-4 flex-shrink-0 text-gray-400" strokeWidth={2} aria-hidden />
                    )}
                    <span className="truncate">{expandLabel}</span>
                  </button>
                ) : null}
                {sessionMenuHasAnyItem ? (
                  <>
                    {showSessionStartNew ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={sessionStartNewDisabled}
                        className={cx(itemClass, sessionStartNewDisabled && sessionItemDisabledClass)}
                        onClick={() => {
                          if (sessionStartNewDisabled) return;
                          onSessionStartNewChat?.();
                          setSessionOpen(false);
                        }}
                      >
                        <MessageSquarePlus className={sessionIconClass} strokeWidth={2} aria-hidden />
                        <span className="truncate">{startNewChatLabel}</span>
                      </button>
                    ) : null}
                    {showSessionEndChat ? (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={sessionEndChatDisabled}
                        className={cx(itemClass, sessionEndChatDisabled && sessionItemDisabledClass)}
                        onClick={() => {
                          if (sessionEndChatDisabled) return;
                          onSessionEndChat?.();
                          setSessionOpen(false);
                        }}
                      >
                        <LogOut className={sessionIconClass} strokeWidth={2} aria-hidden />
                        <span className="truncate">{endChatLabel}</span>
                      </button>
                    ) : null}
                    {showSessionRecentChats ? (
                      <button
                        type="button"
                        role="menuitem"
                        className={itemClass}
                        onClick={() => {
                          onSessionOpenHistory?.();
                          setSessionOpen(false);
                        }}
                      >
                        <History className={sessionIconClass} strokeWidth={2} aria-hidden />
                        <span className="truncate">{recentChatsLabel}</span>
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {legacyMenuOnly ? (
          <button type="button" onClick={() => onMenu?.()} className={menuBtnClass} aria-label={menuLabel}>
            <MenuIcon />
          </button>
        ) : null}

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={cx(
              "rounded-lg p-2 transition-colors",
              dark ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200 hover:text-gray-800"
            )}
            aria-label={closeLabel}
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>
    </header>
  );
}
