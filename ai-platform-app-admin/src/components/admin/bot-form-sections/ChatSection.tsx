"use client";

import MenuQuickLinksEditor from "@/components/admin/MenuQuickLinksEditor";
import { QuickLinksMenuIconPicker } from "@/components/admin/QuickLinksMenuIconPicker";
import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsGrid,
  SettingsFieldRow,
  SettingsToggleRow,
} from "@/components/admin/settings";
import { Input } from "@/components/ui/Input";
import { BOT_FIELD_MAX } from "@/lib/botFieldLimits";
import type { ChatStatusIndicator, LiveIndicatorStyle } from "@/models/Bot";

import { useBotFormEditor } from "./BotFormEditorContext";
import { TAB_CONTENT_CLASS, TAB_META } from "./botFormUiConstants";

export function ChatSection() {
  const { chatUI, setChatUI } = useBotFormEditor();

  return (
    <div className={TAB_CONTENT_CLASS}>
          <SettingsPageHeader
            title={TAB_META["chat-experience"].title}
            description={TAB_META["chat-experience"].description}
          />
          <SettingsSectionCard
            title="Input Tools"
            description="Suggested questions and composer visibility. Attachments and voice are under Integrations & AI."
          >
            <div className="space-y-3">
              <SettingsToggleRow
                label="Show chat input with suggested questions"
                htmlFor="show-composer-suggested"
                control={
                  <input
                    id="show-composer-suggested"
                    type="checkbox"
                    checked={chatUI.showComposerWithSuggestedQuestions === true}
                    onChange={(e) =>
                      setChatUI((prev) => ({ ...prev, showComposerWithSuggestedQuestions: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                  />
                }
              />
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Message features"
            description="Copy on replies, feedback, and how visitor text and voice bubbles appear in the widget."
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <SettingsToggleRow
                  label="Show copy button"
                  htmlFor="show-copy"
                  control={
                    <input
                      id="show-copy"
                      type="checkbox"
                      checked={chatUI.showCopyButton !== false}
                      onChange={(e) => setChatUI((prev) => ({ ...prev, showCopyButton: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                <SettingsToggleRow
                  label="Show thumbs up / down on replies"
                  htmlFor="show-message-feedback"
                  helperText="Sends anonymous feedback events to analytics (message id, conversation id, rating)."
                  control={
                    <input
                      id="show-message-feedback"
                      type="checkbox"
                      checked={chatUI.showMessageFeedback !== false}
                      onChange={(e) => setChatUI((prev) => ({ ...prev, showMessageFeedback: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                <SettingsFieldRow
                  label="Visitor text message bubbles"
                  htmlFor="admin-user-text-bubble-style"
                  helperText="Typed user messages only. Brand color uses brand fill; default uses neutral thread styling."
                >
                  <select
                    id="admin-user-text-bubble-style"
                    value={
                      chatUI.userTextBubbleStyle === "default"
                        ? "default"
                        : chatUI.userTextBubbleStyle === "defaultDark"
                          ? "defaultDark"
                          : "primary"
                    }
                    onChange={(e) =>
                      setChatUI((prev) => ({
                        ...prev,
                        userTextBubbleStyle: e.target.value as "primary" | "default" | "defaultDark",
                      }))
                    }
                    className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="primary">Brand color</option>
                    <option value="default">Default (neutral)</option>
                    <option value="defaultDark">Default (dark)</option>
                  </select>
                </SettingsFieldRow>
                <SettingsFieldRow
                  label="Visitor voice message bubbles"
                  htmlFor="admin-user-voice-bubble-style"
                  helperText="Voice messages only. Brand color uses a brand-filled bubble; default is neutral with the standard waveform."
                >
                  <select
                    id="admin-user-voice-bubble-style"
                    value={
                      chatUI.userVoiceBubbleStyle === "default"
                        ? "default"
                        : chatUI.userVoiceBubbleStyle === "defaultDark"
                          ? "defaultDark"
                          : "primary"
                    }
                    onChange={(e) =>
                      setChatUI((prev) => ({
                        ...prev,
                        userVoiceBubbleStyle: e.target.value as "primary" | "default" | "defaultDark",
                      }))
                    }
                    className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="primary">Brand color</option>
                    <option value="default">Default (neutral)</option>
                    <option value="defaultDark">Default (dark)</option>
                  </select>
                </SettingsFieldRow>
              </div>
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Header & Presence"
            description="Control identity and status information displayed in the chat header."
          >
            <div className="space-y-4">
              <SettingsGrid>
                <SettingsToggleRow
                  label="Show bot avatar in header"
                  htmlFor="show-avatar-header"
                  control={
                    <input
                      id="show-avatar-header"
                      type="checkbox"
                      checked={chatUI.showAvatarInHeader !== false}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, showAvatarInHeader: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                <SettingsFieldRow label="Indicator" htmlFor="status-indicator">
                  <select
                    id="status-indicator"
                    value={chatUI.statusIndicator ?? "none"}
                    onChange={(e) =>
                      setChatUI((prev) => ({
                        ...prev,
                        statusIndicator: e.target.value as ChatStatusIndicator,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="none">None</option>
                    <option value="live">Live</option>
                    <option value="active">Active</option>
                  </select>
                </SettingsFieldRow>
                {(chatUI.statusIndicator === "live" || chatUI.statusIndicator === "active") ? (
                  <div className="contents">
                    <SettingsFieldRow label="Style" htmlFor="live-indicator-style">
                      <select
                        id="live-indicator-style"
                        value={chatUI.liveIndicatorStyle ?? "label"}
                        onChange={(e) =>
                          setChatUI((prev) => ({
                            ...prev,
                            liveIndicatorStyle: e.target.value as LiveIndicatorStyle,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="label">Label + dot (next to bot name)</option>
                        <option value="dot-only">Dot only (on avatar)</option>
                      </select>
                    </SettingsFieldRow>
                    <SettingsFieldRow label="Dot style" htmlFor="status-dot-style">
                      <select
                        id="status-dot-style"
                        value={chatUI.statusDotStyle ?? "blinking"}
                        onChange={(e) =>
                          setChatUI((prev) => ({
                            ...prev,
                            statusDotStyle: e.target.value as "blinking" | "static",
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                      >
                        <option value="blinking">Blinking</option>
                        <option value="static">Static</option>
                      </select>
                    </SettingsFieldRow>
                  </div>
                ) : (
                  <div className="contents">
                    <SettingsFieldRow
                      label="Style"
                      htmlFor="live-indicator-style-disabled"
                      disabled
                      dependencyNote="Select an indicator above to customize."
                    >
                      <select id="live-indicator-style-disabled" disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
                        <option>—</option>
                      </select>
                    </SettingsFieldRow>
                    <SettingsFieldRow
                      label="Dot style"
                      htmlFor="status-dot-style-disabled"
                      disabled
                      dependencyNote="Select an indicator above to customize."
                    >
                      <select id="status-dot-style-disabled" disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500">
                        <option>—</option>
                      </select>
                    </SettingsFieldRow>
                  </div>
                )}
              </SettingsGrid>
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Navigation & Utility"
            description="Extra features that improve chat usability."
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <SettingsToggleRow
                  label="Scroll-to-bottom button"
                  htmlFor="scroll-to-bottom"
                  control={
                    <input
                      id="scroll-to-bottom"
                      type="checkbox"
                      checked={chatUI.showScrollToBottom !== false}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, showScrollToBottom: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                {chatUI.showScrollToBottom !== false ? (
                  <>
                    <SettingsToggleRow
                      label="Show label next to arrow"
                      htmlFor="scroll-to-bottom-label-show"
                      helperText="Arrow is always shown; turn off to use icon only."
                      control={
                        <input
                          id="scroll-to-bottom-label-show"
                          type="checkbox"
                          checked={chatUI.showScrollToBottomLabel !== false}
                          onChange={(e) =>
                            setChatUI((prev) => ({
                              ...prev,
                              showScrollToBottomLabel: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                      }
                    />
                    <SettingsFieldRow
                      label="Scroll button text"
                      htmlFor="scroll-to-bottom-label-text"
                      helperText='Default is "Scroll to latest" when empty.'
                    >
                      <Input
                        id="scroll-to-bottom-label-text"
                        value={chatUI.scrollToBottomLabel ?? ""}
                        maxLength={BOT_FIELD_MAX.scrollToBottomLabel}
                        onChange={(e) =>
                          setChatUI((prev) => ({
                            ...prev,
                            scrollToBottomLabel: e.target.value.slice(0, BOT_FIELD_MAX.scrollToBottomLabel),
                          }))
                        }
                        placeholder="Scroll to latest"
                        className="w-full max-w-md"
                        disabled={chatUI.showScrollToBottomLabel === false}
                      />
                    </SettingsFieldRow>
                  </>
                ) : null}
                <SettingsToggleRow
                  label="Message list scrollbar"
                  htmlFor="show-scrollbar"
                  helperText="When on, a slim scrollbar is shown. When off, the bar is hidden (still scrollable)."
                  control={
                    <input
                      id="show-scrollbar"
                      type="checkbox"
                      checked={chatUI.showScrollbar !== false}
                      onChange={(e) => setChatUI((prev) => ({ ...prev, showScrollbar: e.target.checked }))}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                <SettingsFieldRow
                  label="Message list scrollbar"
                  htmlFor="scroll-chrome-style"
                  helperText="Thumb color when the transcript scrollbar is visible."
                >
                  <select
                    id="scroll-chrome-style"
                    value={(() => {
                      const s = chatUI.scrollChromeStyle;
                      if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
                      if (s === 'gray') return 'defaultDark';
                      return chatUI.scrollChromeUsesPrimary === false ? 'default' : 'primary';
                    })()}
                    onChange={(e) =>
                      setChatUI((prev) => ({
                        ...prev,
                        scrollChromeStyle: e.target.value as 'default' | 'defaultDark' | 'primary',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="default">Default</option>
                    <option value="defaultDark">Default (dark)</option>
                    <option value="primary">Brand color</option>
                  </select>
                </SettingsFieldRow>
                <SettingsFieldRow
                  label="Scroll to latest button"
                  htmlFor="scroll-to-bottom-chrome-style"
                  helperText="Floating button when the visitor scrolls up."
                >
                  <select
                    id="scroll-to-bottom-chrome-style"
                    value={(() => {
                      const s = chatUI.scrollToBottomChromeStyle;
                      if (s === 'default' || s === 'defaultDark' || s === 'primary') return s;
                      if (s === 'gray') return 'defaultDark';
                      const sb = chatUI.scrollChromeStyle;
                      if (sb === 'default' || sb === 'defaultDark' || sb === 'primary') return sb;
                      if (sb === 'gray') return 'defaultDark';
                      return chatUI.scrollChromeUsesPrimary === false ? 'default' : 'primary';
                    })()}
                    onChange={(e) =>
                      setChatUI((prev) => ({
                        ...prev,
                        scrollToBottomChromeStyle: e.target.value as 'default' | 'defaultDark' | 'primary',
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  >
                    <option value="default">Default</option>
                    <option value="defaultDark">Default (dark)</option>
                    <option value="primary">Brand color</option>
                  </select>
                </SettingsFieldRow>
                <SettingsToggleRow
                  label="Expand chat in menu"
                  htmlFor="show-menu-expand"
                  control={
                    <input
                      id="show-menu-expand"
                      type="checkbox"
                      checked={chatUI.showMenuExpand !== false}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, showMenuExpand: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                <SettingsToggleRow
                  label="Open chat on page load"
                  htmlFor="open-chat-on-load"
                  control={
                    <input
                      id="open-chat-on-load"
                      type="checkbox"
                      checked={chatUI.openChatOnLoad !== false}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, openChatOnLoad: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
              </div>
              <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
                <SettingsToggleRow
                  label="Show quick links menu"
                  htmlFor="show-menu-quick-links"
                  helperText="When on, a header button opens your configured links. Turn off to hide it entirely."
                  control={
                    <input
                      id="show-menu-quick-links"
                      type="checkbox"
                      checked={chatUI.showMenuQuickLinks !== false}
                      onChange={(e) =>
                        setChatUI((prev) => ({ ...prev, showMenuQuickLinks: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                  }
                />
                {chatUI.showMenuQuickLinks !== false ? (
                  <div className="mt-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/40">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Up to 10 links. Each needs a label and a path or URL. Pick a menu button icon, then add links.
                    </p>
                    <SettingsFieldRow
                      label="Menu button icon"
                      htmlFor="quick-links-menu-icon"
                      helperText="Shown on the header control that opens this list."
                    >
                      <QuickLinksMenuIconPicker
                        value={chatUI.menuQuickLinksMenuIcon}
                        onChange={(next) =>
                          setChatUI((prev) => ({ ...prev, menuQuickLinksMenuIcon: next }))
                        }
                      />
                    </SettingsFieldRow>
                    <MenuQuickLinksEditor
                      value={chatUI.menuQuickLinks}
                      onChange={(next) =>
                        setChatUI((prev) => ({ ...prev, menuQuickLinks: next }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </SettingsSectionCard>

          <SettingsSectionCard
            title="Composer Layout"
            description="Control how the message input area is displayed."
          >
            <SettingsToggleRow
              label="Separate message input box"
              htmlFor="composer-separate"
              helperText="When enabled, the input is shown in a distinct box below the messages instead of inline. Gives a clearer separation between conversation and composer."
              control={
                <input
                  id="composer-separate"
                  type="checkbox"
                  checked={chatUI.composerAsSeparateBox === true}
                  onChange={(e) =>
                    setChatUI((prev) => ({ ...prev, composerAsSeparateBox: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
                />
              }
            />
          </SettingsSectionCard>
    </div>
  );
}
