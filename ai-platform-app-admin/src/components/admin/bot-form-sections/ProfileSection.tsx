"use client";

import {
  SettingsPageHeader,
  SettingsSectionCard,
  SettingsGrid,
  SETTINGS_GRID_FULL,
  SettingsFieldRow,
  SettingsEmptyState,
  SettingsInfoTooltip,
} from "@/components/admin/settings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

import { useBotFormEditor } from "./BotFormEditorContext";
import { TAB_CONTENT_CLASS, TAB_META } from "./botFormUiConstants";
import { BrokenImagePlaceholder, isSafeImagePreviewSrc } from "./imagePreviewUtils";

export function ProfileSection() {
  const {
    name,
    setName,
    includeNameInKnowledge,
    setIncludeNameInKnowledge,
    shortDescription,
    setShortDescription,
    description,
    setDescription,
    previewSrc,
    botAvatarPreviewLoadFailed,
    setBotAvatarPreviewLoadFailed,
    handleRemoveAvatar,
    isRemovingImage,
    hasImage,
    avatarEmoji,
    setAvatarEmoji,
    botImageUrl,
    setBotImageUrl,
    fileInputRef,
    handleFilePick,
    dragOver,
    setDragOver,
    hasImageUrl,
    hasImageFile,
    setPreviewVisible,
  } = useBotFormEditor();

  return (
    <div className={TAB_CONTENT_CLASS}>
      <SettingsPageHeader title={TAB_META.general.title} description={TAB_META.general.description} />
      <SettingsSectionCard
        title="Identity"
        description="Define the bot's basic identity used across the platform."
      >
        <SettingsGrid>
          <SettingsFieldRow
            label="Bot name"
            htmlFor="bot-name"
            required
            helperText="Display name used in listings, chat header, and across the platform."
          >
            <div className="flex flex-col gap-2 w-full">
              <Input
                id="bot-name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full"
              />
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNameInKnowledge}
                  onChange={(e) => setIncludeNameInKnowledge(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                />
                <span>Include in knowledge base</span>
                <SettingsInfoTooltip
                  content="When enabled, the bot name above is included in the knowledge base and overrides any other name given to the bot, no matter where it's mentioned in context."
                  className="ml-0.5"
                />
              </label>
            </div>
          </SettingsFieldRow>
          <SettingsFieldRow
            label="Tagline"
            htmlFor="bot-tagline"
            helperText="Short headline shown in listings and chat header."
          >
            <Input
              id="bot-tagline"
              type="text"
              value={shortDescription}
              onChange={(event) => setShortDescription(event.target.value)}
              placeholder="e.g. Your 24/7 support assistant"
              className="w-full"
            />
          </SettingsFieldRow>
          <div className={SETTINGS_GRID_FULL}>
            <SettingsFieldRow
              label="Description"
              htmlFor="bot-description"
              required
              helperText="Main public description shown to users."
            >
              <Textarea
                id="bot-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full min-h-[6rem] resize-y"
              />
            </SettingsFieldRow>
          </div>
        </SettingsGrid>
      </SettingsSectionCard>

      <SettingsSectionCard title="Avatar" description="Upload or provide a visual avatar for the bot.">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <div className="flex flex-col">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Bot avatar preview
            </p>
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30">
              {previewSrc ? (
                isSafeImagePreviewSrc(previewSrc) && !botAvatarPreviewLoadFailed ? (
                  <div className="relative p-4">
                    <img
                      src={previewSrc}
                      alt=""
                      width={120}
                      height={120}
                      className="h-[120px] w-[120px] rounded-xl border border-gray-200 object-cover shadow-sm dark:border-gray-600"
                      onError={() => setBotAvatarPreviewLoadFailed(true)}
                    />
                    {hasImage ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isRemovingImage}
                        onClick={() => void handleRemoveAvatar()}
                        className="mt-3 w-full"
                      >
                        {isRemovingImage ? "Removing…" : "Remove avatar"}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="relative p-4">
                    <BrokenImagePlaceholder
                      subtitle={
                        isSafeImagePreviewSrc(previewSrc) && botAvatarPreviewLoadFailed
                          ? "Couldn’t load this image. Check the URL or try another file."
                          : "Enter a valid https:// URL or upload a file to preview."
                      }
                    />
                    {hasImage ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isRemovingImage}
                        onClick={() => void handleRemoveAvatar()}
                        className="mt-3 w-full"
                      >
                        {isRemovingImage ? "Removing…" : "Remove avatar"}
                      </Button>
                    ) : null}
                  </div>
                )
              ) : avatarEmoji.trim() ? (
                <div className="flex min-h-[160px] flex-col items-center justify-center p-4">
                  <span className="text-7xl leading-none" aria-hidden>
                    {avatarEmoji.trim()}
                  </span>
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Emoji avatar (no image)</p>
                </div>
              ) : (
                <SettingsEmptyState
                  title="No image"
                  description="Enter a URL, upload a file, or set an emoji below."
                  className="min-h-[180px] border-0 bg-transparent py-8"
                />
              )}
            </div>
          </div>
          <div className="space-y-4">
            <SettingsFieldRow
              label="Image URL"
              htmlFor="bot-image-url"
              disabled={hasImageFile}
              dependencyNote={hasImageFile ? "Remove the uploaded file to configure this setting." : undefined}
            >
              <Input
                id="bot-image-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                value={botImageUrl}
                disabled={hasImageFile}
                onChange={(event) => {
                  setBotImageUrl(event.target.value);
                  setPreviewVisible(Boolean(event.target.value.trim()));
                }}
                placeholder="https://..."
                className="w-full"
              />
            </SettingsFieldRow>
            <SettingsFieldRow
              label="Or emoji avatar"
              htmlFor="bot-avatar-emoji"
              helperText="Used when no image is set (e.g. one emoji). Max 12 characters."
            >
              <Input
                id="bot-avatar-emoji"
                value={avatarEmoji}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 12);
                  setAvatarEmoji(v);
                  if (!previewSrc && v.trim()) setPreviewVisible(true);
                }}
                placeholder="e.g. 🤖"
                className="w-full max-w-xs"
                maxLength={12}
              />
            </SettingsFieldRow>
            <SettingsFieldRow
              label="Or upload file"
              htmlFor="bot-image-upload"
              helperText="PNG, JPG, or WEBP. Max 2MB."
              disabled={hasImageUrl}
              dependencyNote={hasImageUrl ? "Clear the image URL above to configure this setting." : undefined}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={hasImageUrl}
                onChange={(event) => handleFilePick(event.target.files?.[0] ?? null)}
              />
              <div
                className={`rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
                  hasImageUrl
                    ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800"
                    : dragOver
                      ? "cursor-pointer border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                      : "cursor-pointer border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-gray-500"
                }`}
                onClick={() => {
                  if (!hasImageUrl) fileInputRef.current?.click();
                }}
                onDragOver={(event) => {
                  if (hasImageUrl) return;
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  if (hasImageUrl) return;
                  event.preventDefault();
                  setDragOver(false);
                  handleFilePick(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Drag &amp; drop here or click to browse
                </span>
              </div>
            </SettingsFieldRow>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}
