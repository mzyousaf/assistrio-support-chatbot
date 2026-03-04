"use client";

import React from "react";

import { Input } from "@/components/ui/Input";
import type { BotChatUI } from "@/models/Bot";

interface BotChatUIEditorProps {
  botName: string;
  value: BotChatUI;
  onChange: (next: BotChatUI) => void;
}

const DEFAULT_CHAT_UI: Required<BotChatUI> = {
  primaryColor: "#14B8A6",
  backgroundStyle: "light",
  bubbleStyle: "rounded",
  avatarStyle: "emoji",
  launcherPosition: "bottom-right",
  font: "inter",
  showBranding: true,
};

function sanitizeHexColor(input: string): string | null {
  const value = input.trim();
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function toRgba(hex: string, alpha: number): string {
  const safe = sanitizeHexColor(hex) ?? DEFAULT_CHAT_UI.primaryColor;
  const value = safe.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveChatUI(value: BotChatUI): Required<BotChatUI> {
  return {
    primaryColor: sanitizeHexColor(value.primaryColor ?? "") ?? DEFAULT_CHAT_UI.primaryColor,
    backgroundStyle:
      value.backgroundStyle === "auto" || value.backgroundStyle === "dark" || value.backgroundStyle === "light"
        ? value.backgroundStyle
        : DEFAULT_CHAT_UI.backgroundStyle,
    bubbleStyle: value.bubbleStyle === "squared" ? "squared" : DEFAULT_CHAT_UI.bubbleStyle,
    avatarStyle:
      value.avatarStyle === "emoji" || value.avatarStyle === "image" || value.avatarStyle === "none"
        ? value.avatarStyle
        : DEFAULT_CHAT_UI.avatarStyle,
    launcherPosition: value.launcherPosition === "bottom-left" ? "bottom-left" : DEFAULT_CHAT_UI.launcherPosition,
    font:
      value.font === "system" || value.font === "inter" || value.font === "poppins" ? value.font : DEFAULT_CHAT_UI.font,
    showBranding: value.showBranding !== false,
  };
}

function fontFamilyFor(font: Required<BotChatUI>["font"]): string {
  if (font === "poppins") return "Poppins, ui-sans-serif, system-ui, sans-serif";
  if (font === "inter") return "Inter, ui-sans-serif, system-ui, sans-serif";
  return "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
}

export default function BotChatUIEditor({ botName, value, onChange }: BotChatUIEditorProps) {
  const resolved = resolveChatUI(value);
  const previewRadius = resolved.bubbleStyle === "rounded" ? "16px" : "6px";
  const previewBackground =
    resolved.backgroundStyle === "dark" ? "#0f172a" : resolved.backgroundStyle === "light" ? "#f8fafc" : "#e2e8f0";

  const patch = <K extends keyof BotChatUI>(key: K, nextValue: BotChatUI[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Primary color</span>
          <span className="block text-xs text-gray-500">Brand accent used on assistant bubbles and highlights.</span>
          <div className="flex items-center gap-2">
            <Input type="color" value={resolved.primaryColor} onChange={(event) => patch("primaryColor", event.target.value)} />
            <Input
              value={resolved.primaryColor}
              onChange={(event) => patch("primaryColor", event.target.value)}
              placeholder="#14B8A6"
            />
          </div>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Background style</span>
          <span className="block text-xs text-gray-500">Sets the chat shell contrast.</span>
          <select
            value={resolved.backgroundStyle}
            onChange={(event) => patch("backgroundStyle", event.target.value as BotChatUI["backgroundStyle"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Bubble style</span>
          <span className="block text-xs text-gray-500">Controls message corner radius.</span>
          <select
            value={resolved.bubbleStyle}
            onChange={(event) => patch("bubbleStyle", event.target.value as BotChatUI["bubbleStyle"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <option value="rounded">Rounded</option>
            <option value="squared">Squared</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Avatar style</span>
          <span className="block text-xs text-gray-500">Choose how bot avatar appears.</span>
          <select
            value={resolved.avatarStyle}
            onChange={(event) => patch("avatarStyle", event.target.value as BotChatUI["avatarStyle"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <option value="emoji">Emoji</option>
            <option value="image">Image</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Launcher position</span>
          <span className="block text-xs text-gray-500">Where the launcher should appear for embeddable widgets.</span>
          <select
            value={resolved.launcherPosition}
            onChange={(event) => patch("launcherPosition", event.target.value as BotChatUI["launcherPosition"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-gray-900">Font</span>
          <span className="block text-xs text-gray-500">Applies to chat text and controls.</span>
          <select
            value={resolved.font}
            onChange={(event) => patch("font", event.target.value as BotChatUI["font"])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
          >
            <option value="system">System</option>
            <option value="inter">Inter</option>
            <option value="poppins">Poppins</option>
          </select>
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={resolved.showBranding}
          onChange={(event) => patch("showBranding", event.target.checked)}
        />
        Show branding
      </label>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-500 mb-3">Live preview</p>
        <div
          className="mx-auto w-full max-w-[320px] overflow-hidden border border-gray-200 shadow-sm"
          style={{
            borderRadius: "18px",
            backgroundColor: previewBackground,
            fontFamily: fontFamilyFor(resolved.font),
            position: "relative",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: resolved.primaryColor }}
          >
            <span>{botName || "Bot"}</span>
            <button type="button" className="opacity-90">
              x
            </button>
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-start gap-2">
              {resolved.avatarStyle === "none" ? null : (
                <div className="mt-1 h-5 w-5 shrink-0 rounded-full bg-gray-200 text-[10px] flex items-center justify-center">
                  {resolved.avatarStyle === "emoji" ? "🤖" : "IMG"}
                </div>
              )}
              <div
                className="max-w-[85%] px-3 py-2 text-xs text-gray-900"
                style={{
                  backgroundColor: toRgba(resolved.primaryColor, 0.2),
                  borderRadius: previewRadius,
                }}
              >
                Hi! I can help with your questions.
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[85%] bg-gray-200 px-3 py-2 text-xs text-gray-800" style={{ borderRadius: previewRadius }}>
                What plans do you offer?
              </div>
            </div>
            <div
              className="max-w-[85%] px-3 py-2 text-xs text-gray-900"
              style={{
                backgroundColor: toRgba(resolved.primaryColor, 0.2),
                borderRadius: previewRadius,
              }}
            >
              We offer Starter, Pro, and Enterprise plans.
            </div>
          </div>
          <div className="border-t border-gray-200 bg-white p-2">
            <div className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-400">Type your message...</div>
          </div>
          {resolved.showBranding ? (
            <div className="border-t border-gray-100 bg-gray-50 px-2 py-1 text-center text-[10px] text-gray-500">
              Powered by Assistrio
            </div>
          ) : null}
          <div
            className="h-7 w-7 rounded-full border-2 border-white shadow-sm"
            style={{
              position: "absolute",
              bottom: "10px",
              right: resolved.launcherPosition === "bottom-right" ? "10px" : undefined,
              left: resolved.launcherPosition === "bottom-left" ? "10px" : undefined,
              backgroundColor: resolved.primaryColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}
