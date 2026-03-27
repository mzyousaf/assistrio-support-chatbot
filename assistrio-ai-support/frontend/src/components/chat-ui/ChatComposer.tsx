"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { cx } from "./utils";

const LINE_HEIGHT = 16;
const MIN_HEIGHT_PX = 32;
const MIN_ROWS = MIN_HEIGHT_PX / LINE_HEIGHT; // 2
const DEFAULT_MAX_ROWS = 8;

const EMOJI_PICKER_CDN =
  "https://cdn.jsdelivr.net/npm/emoji-picker-element@1/index.js";

export interface ChatComposerProps {
  /** Dark theme (default true) */
  dark?: boolean;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  /** Accent color for send button */
  accentColor?: string;
  /** Max character count for input (optional) */
  inputMaxLength?: number;
  /** Max rows for auto-grow textarea (default 8) */
  maxComposerRows?: number;
  /** Show attach button */
  showAttach?: boolean;
  /** Show emoji button + picker (enables inserting emoji into messages) */
  showEmoji?: boolean;
  /** Show mic button */
  showMic?: boolean;
  /** When true, composer is a separate box (border-top + bg). When false, no border and no bg. */
  asSeparateBox?: boolean;
  /** Message input border width in px. 0 = default 1px; 0.5–6 = custom. Focus = width × 1.5. Default 1. */
  composerBorderWidth?: number;
  /** When width >= 0.5: "default" = gray, "primary" = accent. Default "primary". */
  composerBorderColor?: "default" | "primary";
  onAttach?: () => void;
  onEmoji?: () => void;
  onMic?: () => void;
  className?: string;
}

export function ChatComposer({
  dark = true,
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type a message…",
  sendLabel = "Send",
  accentColor = "#6366f1",
  inputMaxLength,
  maxComposerRows = DEFAULT_MAX_ROWS,
  showAttach = true,
  showEmoji = true,
  showMic = true,
  asSeparateBox = true,
  composerBorderWidth = 1,
  composerBorderColor = "primary",
  onAttach,
  onEmoji,
  onMic,
  className,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiPickerContainerRef = useRef<HTMLDivElement>(null);
  const [emojiPickerReady, setEmojiPickerReady] = useState(false);

  // Load emoji-picker-element from CDN once
  useEffect(() => {
    if (typeof customElements === "undefined") return;
    if (customElements.get("emoji-picker")) {
      setEmojiPickerReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = EMOJI_PICKER_CDN;
    script.type = "module";
    script.async = true;
    script.onload = () => {
      customElements.whenDefined("emoji-picker").then(() => setEmojiPickerReady(true));
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = textareaRef.current;
      if (el) {
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + emoji + value.slice(end);
        onChange(next);
        setTimeout(() => {
          el.focus();
          const newPos = start + emoji.length;
          el.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        onChange(value + emoji);
      }
      setEmojiPickerOpen(false);
      onEmoji?.();
    },
    [value, onChange, onEmoji]
  );
  const insertEmojiRef = useRef(insertEmoji);
  insertEmojiRef.current = insertEmoji;

  // Mount/unmount emoji-picker web component when popover is open
  useEffect(() => {
    if (!emojiPickerOpen || !emojiPickerReady || !emojiPickerContainerRef.current) return;
    const container = emojiPickerContainerRef.current;
    const picker = document.createElement("emoji-picker");
    picker.setAttribute("class", dark ? "dark" : "light");
    const onEmojiClick = (e: CustomEvent<{ unicode: string }>) => {
      if (e.detail?.unicode) insertEmojiRef.current(e.detail.unicode);
    };
    picker.addEventListener("emoji-click", onEmojiClick as EventListener);
    container.appendChild(picker);
    return () => {
      picker.removeEventListener("emoji-click", onEmojiClick as EventListener);
      picker.remove();
    };
  }, [emojiPickerOpen, emojiPickerReady, dark]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiPickerOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) onSend();
      }
    },
    [disabled, value, onSend]
  );

  // Auto-grow textarea (start empty at 32px, grow with content)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value.trim()) {
      el.style.height = `${MIN_HEIGHT_PX}px`;
      return;
    }
    el.style.height = "auto";
    const rows = Math.min(
      maxComposerRows,
      Math.max(MIN_ROWS, Math.ceil(el.scrollHeight / LINE_HEIGHT))
    );
    el.style.height = `${Math.max(MIN_HEIGHT_PX, rows * LINE_HEIGHT)}px`;
  }, [value, maxComposerRows]);

  return (
    <div
      className={cx(
        "flex-shrink-0 p-3",
        asSeparateBox && "border-t",
        asSeparateBox && (dark ? "border-gray-700 bg-gray-900/30" : "border-gray-200 bg-gray-50"),
        className
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && value.trim()) onSend();
        }}
        className="flex flex-col gap-2"
      >
        <div
          className={cx(
            "rounded-xl border chat-composer-input-wrapper transition-[border-color,border-width]",
            composerBorderWidth >= 0.5 && "chat-composer-input-wrapper--custom",
            dark ? "bg-gray-800/50" : "bg-white"
          )}
          style={
            (() => {
              const usePrimary = composerBorderColor === "primary";
              const grayBorder = dark ? "#4b5563" : "#d1d5db";
              const grayFocus = dark ? "#6b7280" : "#9ca3af";
              const width = composerBorderWidth >= 0.5 ? composerBorderWidth : 1;
              const focusWidth = composerBorderWidth >= 0.5 ? Math.min(composerBorderWidth * 1.5, 5) : 1;
              return {
                borderWidth: width,
                borderStyle: "solid",
                borderColor:
                  composerBorderWidth >= 0.5 && usePrimary && accentColor
                    ? `${accentColor}99`
                    : grayBorder,
                ["--chat-accent" as string]: accentColor || "#6366f1",
                ["--composer-border-width" as string]: `${width}px`,
                ["--composer-border-width-focus" as string]: `${focusWidth}px`,
                ["--composer-border-color-focus" as string]:
                  composerBorderWidth >= 0.5 && usePrimary ? "var(--chat-accent)" : grayFocus,
              } as React.CSSProperties;
            })()
          }
        >
          <div className="flex flex-row items-end gap-1 p-2">
            {/* Left column: icons + textarea (one group), row-aligned with send */}
            <div className="flex flex-1 flex-col items-start min-w-0 gap-1">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                maxLength={inputMaxLength}
                disabled={disabled}
                className={cx(
                  "flex-1 min-h-[32px] resize-none bg-transparent px-2 py-2 text-left w-full overflow-y-auto scrollbar-hide chat-composer-textarea",
                  "text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                  dark ? "text-gray-100 placeholder:text-gray-500" : "text-gray-900 placeholder:text-gray-400"
                )}
                aria-label={placeholder}
                style={{
                  lineHeight: `${LINE_HEIGHT}px`,
                  height: `${MIN_HEIGHT_PX}px`,
                  minHeight: `${MIN_HEIGHT_PX}px`,
                  maxHeight: `${maxComposerRows * LINE_HEIGHT}px`,
                }}
              />
              <div className="flex items-center gap-0.5 flex-shrink-0 pb-0.5">
                {showAttach ? (
                  <button
                    type="button"
                    onClick={onAttach}
                    className={cx(
                      "p-2 rounded-lg transition-colors",
                      dark ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                    )}
                    aria-label="Attach file"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                ) : null}
                {showEmoji ? (
                  <div className="relative flex-shrink-0" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen((o) => !o)}
                      className={cx(
                        "p-2 rounded-lg transition-colors",
                        dark ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                      )}
                      aria-label="Insert emoji"
                      aria-expanded={emojiPickerOpen}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    {emojiPickerOpen ? (
                      <div
                        className={cx(
                          "absolute left-0 bottom-full mb-2 rounded-xl border shadow-lg z-[100] overflow-visible",
                          "min-w-[320px] min-h-[320px]",
                          dark
                            ? "border-gray-600 bg-gray-800"
                            : "border-gray-200 bg-white"
                        )}
                        aria-label="Emoji picker"
                      >
                        {!emojiPickerReady ? (
                          <div
                            className={cx(
                              "flex items-center justify-center p-8 text-sm",
                              dark ? "text-gray-400" : "text-gray-500"
                            )}
                          >
                            Loading emoji picker…
                          </div>
                        ) : (
                          <div
                            ref={emojiPickerContainerRef}
                            className="chat-emoji-picker-cdn w-full overflow-hidden rounded-xl [&::part(root)]:border-0"
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {showMic ? (
                  <button
                    type="button"
                    onClick={onMic}
                    className={cx(
                      "p-2 rounded-lg transition-colors",
                      dark ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                    )}
                    aria-label="Voice input"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0V8a5 5 0 0110 0v6z" />
                    </svg>
                  </button>
                ) : null}
              </div>

            </div>
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="flex-shrink-0 rounded-lg p-2 text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: accentColor }}
              aria-label={sendLabel}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
