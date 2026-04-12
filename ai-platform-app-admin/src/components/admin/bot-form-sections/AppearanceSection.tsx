"use client";

import { Bot, ImageOff, MessageCircle } from "lucide-react";

import MenuQuickLinksEditor from "@/components/admin/MenuQuickLinksEditor";
import { QuickLinksMenuIconPicker } from "@/components/admin/QuickLinksMenuIconPicker";
import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsGrid,
  SETTINGS_GRID_FULL,
  SettingsFieldRow,
  SettingsToggleRow,
  SettingsEmptyState,
  SettingsDependencyAlert,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  BUBBLE_RADIUS_MAX,
  BUBBLE_RADIUS_MIN,
  type BotChatUI,
  type ChatLauncherIcon,
  type ChatShadowIntensity,
} from "@/models/Bot";

import { useBotFormEditor } from "./BotFormEditorContext";
import { DEFAULT_CHAT_UI } from "./botFormPayloadUtils";
import { TAB_CONTENT_CLASS, TAB_META } from "./botFormUiConstants";
import { BrokenImagePlaceholder, isSafeImagePreviewSrc, launcherCustomUrlInputValue } from "./imagePreviewUtils";

export function AppearanceSection() {
  const {
    chatUI,
    setChatUI,
    name,
    botImageObjectUrl,
    botImageUrl,
    avatarEmoji,
    setLauncherThemePreviewFailed,
    launcherCustomPreviewLoadFailed,
    setLauncherCustomPreviewLoadFailed,
    launcherThemePreviewFailed,
  } = useBotFormEditor();
const appearanceLauncherPreviewPx = Math.min(
  Math.min(96, Math.max(32, chatUI.launcherSize ?? 48)),
  64,
);
const appearanceRingPct = Math.min(30, Math.max(0, chatUI.launcherAvatarRingWidth ?? 18));
const appearanceLauncherShadow =
  chatUI.shadowIntensity === "none"
    ? "shadow-none"
    : chatUI.shadowIntensity === "low"
      ? "shadow-sm"
      : chatUI.shadowIntensity === "high"
        ? "shadow-lg"
        : "shadow-md";
const appearanceEmojiFontPx = Math.min(
  40,
  Math.max(14, Math.round(appearanceLauncherPreviewPx * 0.38)),
);
return (
  <div className={TAB_CONTENT_CLASS}>
    <SettingsPageHeader
      title={TAB_META.appearance.title}
      description={TAB_META.appearance.description}
    />
    <SettingsSectionCard
      title="Theme"
      description="Colors, background, and panel styling for the chat widget."
    >
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-gray-800/50">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Theme preview
        </p>
        <div
          className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${chatUI.backgroundStyle === "dark"
            ? "border-gray-600 bg-gray-800"
            : chatUI.backgroundStyle === "auto"
              ? "border-gray-300 bg-gradient-to-r from-gray-100 to-gray-800 dark:border-gray-600"
              : "border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800"
            }`}
          aria-hidden
        >
          <div
            className="h-6 w-6 shrink-0 rounded-md border border-white/20 shadow-sm"
            style={{
              backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                : DEFAULT_CHAT_UI.primaryColor,
            }}
          />
          <div
            className="max-w-[120px] px-2.5 py-1.5 text-xs text-white shadow-sm"
            style={{
              backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                : DEFAULT_CHAT_UI.primaryColor,
              borderRadius: `${Math.min(BUBBLE_RADIUS_MAX, Math.max(BUBBLE_RADIUS_MIN, chatUI.bubbleBorderRadius ?? 20))}px`,
            }}
          >
            Sample bubble
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {chatUI.backgroundStyle === "dark" ? "Dark" : chatUI.backgroundStyle === "light" ? "Light" : "Auto"}
          </span>
        </div>
      </div>
      <SettingsGrid>
        <SettingsFieldRow
          label="Primary color"
          htmlFor="primary-color"
          helperText="Brand accent for assistant bubbles and highlights."
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="h-10 w-10 shrink-0 rounded-lg border border-gray-300 shadow-inner dark:border-gray-600"
              style={{
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                  ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                  : DEFAULT_CHAT_UI.primaryColor,
              }}
              aria-hidden
            />
            <input
              id="primary-color"
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                : DEFAULT_CHAT_UI.primaryColor}
              onChange={(e) => setChatUI((prev) => ({ ...prev, primaryColor: e.target.value }))}
              className="h-10 w-10 cursor-pointer rounded border border-gray-300 bg-transparent p-0 dark:border-gray-600"
              aria-label="Primary color picker"
            />
            <Input
              value={chatUI.primaryColor ?? ""}
              onChange={(e) => setChatUI((prev) => ({ ...prev, primaryColor: e.target.value }))}
              placeholder="#14B8A6"
              className="min-w-0 flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() =>
                setChatUI((prev) => ({ ...prev, primaryColor: DEFAULT_CHAT_UI.primaryColor }))
              }
            >
              Reset
            </Button>
          </div>
        </SettingsFieldRow>
        <SettingsFieldRow
          label="Background style"
          htmlFor="background-style"
          helperText="Light, dark, or match system (auto)."
        >
          <select
            id="background-style"
            value={chatUI.backgroundStyle ?? "light"}
            onChange={(e) => {
              const v = e.target.value as BotChatUI["backgroundStyle"];
              setChatUI((prev) => ({
                ...prev,
                backgroundStyle: v,
                ...(v === "dark"
                  ? { composerBorderWidth: 2 }
                  : v === "light"
                    ? { composerBorderWidth: 1 }
                    : {}),
              }));
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingsFieldRow>
        <SettingsFieldRow label="Shadow intensity" htmlFor="shadow-intensity">
          <select
            id="shadow-intensity"
            value={chatUI.shadowIntensity ?? "medium"}
            onChange={(e) =>
              setChatUI((prev) => ({ ...prev, shadowIntensity: e.target.value as ChatShadowIntensity }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </SettingsFieldRow>
        <SettingsFieldRow label="Chat panel border" htmlFor="chat-panel-border">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                id="chat-panel-border"
                type="checkbox"
                checked={chatUI.showChatBorder !== false}
                onChange={(e) =>
                  setChatUI((prev) => ({ ...prev, showChatBorder: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">Show border around chat panel</span>
            </div>
            {chatUI.showChatBorder !== false ? (
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <label htmlFor="chat-panel-border-width" className="text-sm text-gray-600 dark:text-gray-400">
                  Width (px)
                </label>
                <Input
                  id="chat-panel-border-width"
                  type="number"
                  min={0}
                  max={5}
                  value={chatUI.chatPanelBorderWidth ?? 1}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n)) {
                      setChatUI((prev) => ({
                        ...prev,
                        chatPanelBorderWidth: Math.max(0, Math.min(5, n)),
                      }));
                    }
                  }}
                  className="w-20"
                />
                <span className="text-xs text-gray-500 dark:text-gray-500">0–5, default 1</span>
              </div>
            ) : null}
          </div>
        </SettingsFieldRow>
        <SettingsFieldRow
          label="Message bubble radius"
          htmlFor="bubble-radius"
          helperText={`Corner radius in px (${BUBBLE_RADIUS_MIN}–${BUBBLE_RADIUS_MAX}). Affects message bubbles and suggested chips.`}
        >
          <Input
            id="bubble-radius"
            type="number"
            min={BUBBLE_RADIUS_MIN}
            max={BUBBLE_RADIUS_MAX}
            value={chatUI.bubbleBorderRadius ?? 20}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n))
                setChatUI((prev) => ({
                  ...prev,
                  bubbleBorderRadius: Math.max(BUBBLE_RADIUS_MIN, Math.min(BUBBLE_RADIUS_MAX, n)),
                }));
            }}
            className="w-24"
          />
        </SettingsFieldRow>
      </SettingsGrid>
    </SettingsSectionCard>

    <SettingsSectionCard
      title="Launcher"
      description="Position, icon, and size of the chat launcher button."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Launcher preview
          </p>
          <div
            className="relative flex min-h-[7.5rem] w-full items-end rounded-lg border border-dashed border-gray-300 bg-gray-100/50 p-3 dark:border-gray-600 dark:bg-gray-900/20"
            aria-hidden
          >
            <div
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white ${appearanceLauncherShadow} ${chatUI.launcherPosition === "bottom-left" ? "mr-auto" : "ml-auto"
                }`}
              style={{
                width: appearanceLauncherPreviewPx,
                height: appearanceLauncherPreviewPx,
                minWidth: 24,
                minHeight: 24,
                backgroundColor: /^#[0-9a-fA-F]{6}$/.test(chatUI.primaryColor ?? "")
                  ? (chatUI.primaryColor ?? DEFAULT_CHAT_UI.primaryColor)
                  : DEFAULT_CHAT_UI.primaryColor,
              }}
            >
              {chatUI.launcherIcon === "bot-avatar" ? (
                (botImageObjectUrl || botImageUrl) &&
                  isSafeImagePreviewSrc(String(botImageObjectUrl || botImageUrl || "")) ? (
                  !launcherThemePreviewFailed ? (
                    <span
                      className="flex h-full w-full items-center justify-center"
                      style={{ padding: `${appearanceRingPct}%` }}
                    >
                      <img
                        src={botImageObjectUrl || botImageUrl || ""}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                        onError={() => setLauncherThemePreviewFailed(true)}
                      />
                    </span>
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200/90 dark:bg-gray-700/90">
                      <ImageOff className="h-[45%] w-[45%] text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    </span>
                  )
                ) : avatarEmoji.trim() ? (
                  <span
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
                    style={{ padding: `${appearanceRingPct}%` }}
                  >
                    <span
                      className="flex max-h-full max-w-full items-center justify-center leading-none"
                      style={{ fontSize: `${appearanceEmojiFontPx}px` }}
                    >
                      {avatarEmoji.trim()}
                    </span>
                  </span>
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center"
                    style={{ padding: `${appearanceRingPct}%` }}
                  >
                    <Bot className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]" strokeWidth={2} aria-hidden />
                  </span>
                )
              ) : chatUI.launcherIcon === "custom" ? (
                chatUI.launcherAvatarUrl &&
                  isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) ? (
                  !launcherThemePreviewFailed ? (
                    <span
                      className="flex h-full w-full items-center justify-center"
                      style={{ padding: `${appearanceRingPct}%` }}
                    >
                      <img
                        src={chatUI.launcherAvatarUrl}
                        alt=""
                        className="h-full w-full rounded-full object-cover"
                        onError={() => setLauncherThemePreviewFailed(true)}
                      />
                    </span>
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200/90 dark:bg-gray-700/90">
                      <ImageOff className="h-[45%] w-[45%] text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    </span>
                  )
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center"
                    style={{ padding: `${appearanceRingPct}%` }}
                  >
                    <Bot className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]" strokeWidth={2} aria-hidden />
                  </span>
                )
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center"
                  style={{ padding: `${appearanceRingPct}%` }}
                >
                  <MessageCircle
                    className="h-[55%] w-[55%] min-h-[14px] min-w-[14px]"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
              )}
            </div>
          </div>
        </div>
        <SettingsGrid>
          <SettingsFieldRow
            label="Launcher position"
            htmlFor="launcher-position"
            helperText="Where the launcher button appears on screen."
          >
            <select
              id="launcher-position"
              value={chatUI.launcherPosition ?? "bottom-right"}
              onChange={(e) =>
                setChatUI((prev) => ({
                  ...prev,
                  launcherPosition: e.target.value as BotChatUI["launcherPosition"],
                }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Launcher icon"
            htmlFor="launcher-icon"
            helperText="Chat icon; or your bot image/emoji; or custom image URL (see below)."
          >
            <select
              id="launcher-icon"
              value={chatUI.launcherIcon ?? "default"}
              onChange={(e) =>
                setChatUI((prev) => ({ ...prev, launcherIcon: e.target.value as ChatLauncherIcon }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="default">Default</option>
              <option value="bot-avatar">Bot Avatar</option>
              <option value="custom">Custom</option>
            </select>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Launcher size"
            htmlFor="launcher-size"
            helperText="Button size in pixels (32–96)."
          >
            <Input
              id="launcher-size"
              type="number"
              min={32}
              max={96}
              value={chatUI.launcherSize ?? 48}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n))
                  setChatUI((prev) => ({
                    ...prev,
                    launcherSize: Math.max(32, Math.min(96, n)),
                  }));
              }}
              className="w-24"
            />
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Ring width"
            htmlFor="launcher-ring-width"
            helperText="Accent ring around the launcher (default icon, avatar, or custom), 0–30%. 0 = none."
          >
            <Input
              id="launcher-ring-width"
              type="number"
              min={0}
              max={30}
              value={chatUI.launcherAvatarRingWidth ?? 18}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n))
                  setChatUI((prev) => ({
                    ...prev,
                    launcherAvatarRingWidth: Math.max(0, Math.min(30, n)),
                  }));
              }}
              className="w-24"
            />
          </SettingsFieldRow>
          <div className={SETTINGS_GRID_FULL}>
            <SettingsFieldRow
              label="When chat is open"
              htmlFor="launcher-when-open"
              helperText="What the launcher button shows while the chat panel is open."
            >
              <select
                id="launcher-when-open"
                value={chatUI.launcherWhenOpen ?? "chevron-down"}
                onChange={(e) =>
                  setChatUI((prev) => ({
                    ...prev,
                    launcherWhenOpen: e.target.value as BotChatUI["launcherWhenOpen"],
                  }))
                }
                className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="chevron-down">Down arrow</option>
                <option value="close">Close (X)</option>
                <option value="same">Same as when closed (launcher)</option>
              </select>
            </SettingsFieldRow>
          </div>
        </SettingsGrid>
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Custom launcher avatar
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="flex flex-col">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Preview
              </p>
              <div className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
                {chatUI.launcherAvatarUrl ? (
                  isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) &&
                    !launcherCustomPreviewLoadFailed ? (
                    <div className="relative p-4">
                      <img
                        src={chatUI.launcherAvatarUrl}
                        alt=""
                        className="h-24 w-24 rounded-full border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                        onError={() => setLauncherCustomPreviewLoadFailed(true)}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setChatUI((prev) => ({ ...prev, launcherAvatarUrl: undefined }))}
                        className="mt-3 w-full"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="relative p-4">
                      <div className="flex justify-center">
                        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border border-dashed border-amber-300/80 bg-amber-50/50 dark:border-amber-700/60 dark:bg-amber-950/30">
                          <ImageOff className="h-10 w-10 text-amber-600/90 dark:text-amber-400/90" strokeWidth={1.75} aria-hidden />
                        </div>
                      </div>
                      <p className="mt-3 max-w-[12rem] text-center text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        {isSafeImagePreviewSrc(String(chatUI.launcherAvatarUrl)) && launcherCustomPreviewLoadFailed
                          ? "Couldn't load this image. Try another URL or upload a file."
                          : "Paste a valid https://… URL or upload an image."}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setChatUI((prev) => ({ ...prev, launcherAvatarUrl: undefined }))}
                        className="mt-3 w-full"
                      >
                        Clear
                      </Button>
                    </div>
                  )
                ) : (
                  <SettingsEmptyState
                    title="No image"
                    description="Upload or paste image URL below."
                    className="min-h-[140px] border-0 bg-transparent py-6"
                  />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Upload or paste an image URL. Used when Launcher icon is {"\u201c"}Custom{"\u201d"}. PNG, JPG or WEBP. Max 2MB.
              </p>
              <input
                id="launcher-custom"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200 dark:text-gray-400"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file || file.size > 2 * 1024 * 1024) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const dataUrl = reader.result;
                    if (typeof dataUrl === "string")
                      setChatUI((prev) => ({ ...prev, launcherAvatarUrl: dataUrl }));
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <SettingsFieldRow
                label="Image URL"
                htmlFor="launcher-avatar-url"
                helperText="HTTPS link to your image. Shown above when valid; invalid URLs show a broken-image hint."
              >
                <Input
                  id="launcher-avatar-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={launcherCustomUrlInputValue(chatUI.launcherAvatarUrl)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChatUI((prev) => ({ ...prev, launcherAvatarUrl: v.trim() || undefined }));
                  }}
                  placeholder="https://example.com/launcher.png"
                  className="w-full"
                />
              </SettingsFieldRow>
            </div>
          </div>
        </div>
      </div>
    </SettingsSectionCard>

    <SettingsSectionCard
      title="Open Animation"
      description="How the chat panel appears when opened."
    >
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400" id="open-animation-label">
          Chat open animation
        </p>
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="radiogroup"
          aria-labelledby="open-animation-label"
        >
          {(
            [
              { value: "slide-up-fade" as const, label: "Slide up + fade" },
              { value: "fade" as const, label: "Fade" },
              { value: "expand" as const, label: "Expand" },
            ] as const
          ).map(({ value, label }) => {
            const selected = (chatUI.chatOpenAnimation ?? "slide-up-fade") === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  setChatUI((prev) => ({ ...prev, chatOpenAnimation: value }))
                }
                className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors ${selected
                  ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-900/30 dark:text-brand-200"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </SettingsSectionCard>

    <SettingsSectionCard
      title="Composer Styling"
      description="Border width and color for the message input box. Only applies when the input is shown as a separate box (Chat Experience → Composer Layout)."
    >
      <div className="space-y-4">
        {chatUI.composerAsSeparateBox !== false ? (
          <SettingsGrid>
            <SettingsFieldRow
              label="Border width"
              htmlFor="composer-border-width"
              helperText="0 = 1px default; 0.5–6 = custom. Focus state uses 50% thicker border."
            >
              <Input
                id="composer-border-width"
                type="number"
                min={0}
                max={6}
                step={0.5}
                value={chatUI.composerBorderWidth ?? 1}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (!Number.isNaN(n)) {
                    const clamped =
                      n > 0 && n < 0.5 ? 0.5 : Math.max(0, Math.min(6, n));
                    setChatUI((prev) => ({ ...prev, composerBorderWidth: clamped }));
                  }
                }}
                className="w-24"
              />
            </SettingsFieldRow>
            <SettingsFieldRow
              label="Border color"
              htmlFor="composer-border-color"
              helperText="Color of the message input box border."
            >
              <select
                id="composer-border-color"
                value={chatUI.composerBorderColor ?? "primary"}
                onChange={(e) =>
                  setChatUI((prev) => ({
                    ...prev,
                    composerBorderColor: e.target.value as "default" | "primary",
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="default">Default (gray)</option>
                <option value="primary">Primary color</option>
              </select>
            </SettingsFieldRow>
          </SettingsGrid>
        ) : (
          <>
            <SettingsDependencyAlert>
              Enable {"\u201c"}Separate message input box{"\u201d"} in Chat Experience to configure this setting.
            </SettingsDependencyAlert>
            <div className="flex flex-wrap gap-4 opacity-60">
              <SettingsFieldRow label="Border width" htmlFor="composer-border-width-disabled">
                <Input id="composer-border-width-disabled" type="number" value={0} disabled className="w-24" />
              </SettingsFieldRow>
              <SettingsFieldRow label="Border color" htmlFor="composer-border-color-disabled">
                <select
                  id="composer-border-color-disabled"
                  disabled
                  className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                >
                  <option>—</option>
                </select>
              </SettingsFieldRow>
            </div>
          </>
        )}
      </div>
    </SettingsSectionCard>

    <SettingsSectionCard
      title="Branding"
      description="Footer text and attribution shown in the chat widget."
    >
      <div className="space-y-4">
        {chatUI.showBranding !== false ||
          (chatUI.showPrivacyText !== false && Boolean(chatUI.privacyText?.trim())) ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Footer preview
            </p>
            <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-center dark:border-gray-700 dark:bg-gray-900">
              {chatUI.showBranding !== false ? (
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {chatUI.brandingMessage?.trim() || "Your branding message will appear here."}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-gray-500">(Branding line hidden)</p>
              )}
              {chatUI.showPrivacyText !== false && chatUI.privacyText?.trim() ? (
                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                  {chatUI.privacyText.trim()}
                </p>
              ) : chatUI.showPrivacyText !== false ? (
                <p className="mt-1 text-[10px] text-gray-400/70 dark:text-gray-500/50">
                  (Privacy line — add text below)
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">(Privacy line hidden)</p>
              )}
            </div>
          </div>
        ) : null}
        <SettingsToggleRow
          label="Show branding"
          htmlFor="show-branding"
          control={
            <input
              id="show-branding"
              type="checkbox"
              checked={chatUI.showBranding !== false}
              onChange={(e) =>
                setChatUI((prev) => ({ ...prev, showBranding: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
            />
          }
        />
        {chatUI.showBranding !== false ? (
          <SettingsFieldRow
            label="Branding message"
            htmlFor="branding-message"
            helperText='Editable text shown in chat footer (e.g. "Powered by…").'
          >
            <Input
              id="branding-message"
              value={chatUI.brandingMessage ?? ""}
              onChange={(e) =>
                setChatUI((prev) => ({ ...prev, brandingMessage: e.target.value || undefined }))
              }
              placeholder="e.g. Powered by Assistrio"
            />
          </SettingsFieldRow>
        ) : (
          <SettingsFieldRow
            label="Branding message"
            htmlFor="branding-message-disabled"
            disabled
            dependencyNote="Enable Show branding to configure this setting."
          >
            <Input id="branding-message-disabled" value="" disabled placeholder="Branding message" className="opacity-60" />
          </SettingsFieldRow>
        )}
        <SettingsToggleRow
          label="Show privacy / footer line"
          htmlFor="show-privacy-text"
          helperText="Second line for privacy, legal, or notices (below the branding line when both are shown)."
          control={
            <input
              id="show-privacy-text"
              type="checkbox"
              checked={chatUI.showPrivacyText !== false}
              onChange={(e) =>
                setChatUI((prev) => ({ ...prev, showPrivacyText: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800"
            />
          }
        />
        {chatUI.showPrivacyText !== false ? (
          <SettingsFieldRow
            label="Privacy / footer line"
            htmlFor="privacy-footer-text"
            helperText="Optional second line (e.g. privacy notice). Shown only when this toggle is on and text is not empty."
          >
            <Input
              id="privacy-footer-text"
              value={chatUI.privacyText ?? ""}
              onChange={(e) =>
                setChatUI((prev) => ({ ...prev, privacyText: e.target.value || undefined }))
              }
              placeholder="Your conversations are private and secure."
            />
          </SettingsFieldRow>
        ) : (
          <SettingsFieldRow
            label="Privacy / footer line"
            htmlFor="privacy-footer-text-disabled"
            disabled
            dependencyNote='Enable "Show privacy / footer line" to edit this text.'
          >
            <Input
              id="privacy-footer-text-disabled"
              value=""
              disabled
              placeholder="Privacy line"
              className="opacity-60"
            />
          </SettingsFieldRow>
        )}
      </div>
    </SettingsSectionCard>
  </div>
);

}
