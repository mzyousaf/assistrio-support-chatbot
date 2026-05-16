/**
 * Default English copy for embed shell + chat. Hosts can override via `EmbedChatConfig.widgetStrings`.
 * `locale` is reserved for future presets; only `"en"` is applied today.
 */

export type WidgetLocale = "en";

export interface WidgetStrings {
  /** Init failed (network, invalid keys, etc.) */
  initErrorTitle: string;
  initErrorRetry: string;
  /** Shown on user bubble when send failed */
  messageSendFailed: string;
  retrySend: string;
  /** `aria-label` for typing indicator */
  someoneTyping: string;
  /** `aria-label` for floating chat panel dialog */
  chatDialogLabel: string;
}

export const DEFAULT_WIDGET_STRINGS_EN: WidgetStrings = {
  initErrorTitle: "Chat couldn’t load.",
  initErrorRetry: "Try again",
  messageSendFailed: "Couldn’t send",
  retrySend: "Retry",
  someoneTyping: "Assistant is typing",
  chatDialogLabel: "Chat",
};

export function mergeWidgetStrings(
  overrides?: Partial<WidgetStrings> | undefined,
  _locale?: string | undefined,
): WidgetStrings {
  void _locale;
  return {
    ...DEFAULT_WIDGET_STRINGS_EN,
    ...(overrides ?? {}),
  };
}
