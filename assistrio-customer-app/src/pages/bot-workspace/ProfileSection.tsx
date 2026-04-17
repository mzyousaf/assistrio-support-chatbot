import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Eye,
  ImageUp,
  Info,
  Link2,
  Loader2,
  Save,
  Smile,
  UserRound,
  X,
} from 'lucide-react';
import { patchCustomerBot } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { useBotWorkspace } from './BotWorkspaceContext';
import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  FieldRow,
  Input,
  Textarea,
  Tooltip,
} from '@/components/ui';
import { useWidgetPreviewShell } from '@/layout/workspace-layout';
import { cn } from '@/lib/utils';

const MAX_EMOJI_LEN = 12;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const SAFE_IMAGE_PROTOCOL = /^(https?:|data:image\/)/i;

/** Matches `AgentWorkspaceSidebar` label for this route (`playground/profile`). */
const PROFILE_SECTION_NAV_LABEL = 'Profile';

type BotWithExtras = CustomerBotDetail & {
  imageUrl?: string;
  avatarEmoji?: string;
};

function preserveUneditedBotFields(bot: CustomerBotDetail): Record<string, unknown> {
  const b = bot as CustomerBotDetail & Record<string, unknown>;
  return {
    status: bot.status === 'published' ? 'published' : 'draft',
    isPublic: bot.isPublic !== false,
    visibility: bot.visibility === 'private' ? 'private' : 'public',
    messageLimitMode: bot.messageLimitMode === 'fixed_total' ? 'fixed_total' : 'none',
    messageLimitTotal: bot.messageLimitTotal ?? null,
    messageLimitUpgradeMessage: bot.messageLimitUpgradeMessage ?? null,
    chatUI: b.chatUI,
    leadCapture: b.leadCapture,
    faqs: Array.isArray(bot.faqs) ? bot.faqs : [],
    exampleQuestions: Array.isArray(bot.exampleQuestions) ? bot.exampleQuestions : [],
    welcomeMessage: bot.welcomeMessage ?? '',
    knowledgeDescription: bot.knowledgeDescription ?? '',
    categories: Array.isArray(bot.categories)
      ? bot.categories
      : bot.category
        ? [bot.category]
        : [],
    includeTaglineInKnowledge: bot.includeTaglineInKnowledge === true,
    includeNotesInKnowledge: bot.includeNotesInKnowledge !== false,
    personality: b.personality,
    config: b.config,
    ...(typeof b.openaiApiKeyOverride === 'string' && b.openaiApiKeyOverride.trim()
      ? { openaiApiKeyOverride: b.openaiApiKeyOverride.trim() }
      : {}),
    ...(typeof b.whisperApiKeyOverride === 'string' && b.whisperApiKeyOverride
      ? { whisperApiKeyOverride: b.whisperApiKeyOverride }
      : {}),
  };
}

function isSafeImageSrc(src: string) {
  if (!src) return false;
  return SAFE_IMAGE_PROTOCOL.test(src.trim());
}

export function ProfileSection() {
  const { bot, botId, reload } = useBotWorkspace();
  const widgetPreviewShell = useWidgetPreviewShell();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [includeNameInKnowledge, setIncludeNameInKnowledge] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showImageUrlField, setShowImageUrlField] = useState(false);

  useEffect(() => {
    if (!bot) return;
    const b = bot as BotWithExtras;
    setName(String(b.name ?? ''));
    setTagline(String(b.shortDescription ?? ''));
    setDescription(String(b.description ?? ''));
    setIncludeNameInKnowledge(b.includeNameInKnowledge === true);
    const nextUrl = String(b.imageUrl ?? '');
    setImageUrl(nextUrl);
    setShowImageUrlField(nextUrl.trim().length > 0);
    setAvatarEmoji(String(b.avatarEmoji ?? ''));
    setImageFile(null);
    setPreviewFailed(false);
    setDirty(false);
    setSaveError(null);
  }, [bot]);

  useEffect(() => {
    if (!imageFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const previewSrc = useMemo(() => {
    if (imageObjectUrl) return imageObjectUrl;
    const trimmed = imageUrl.trim();
    return trimmed.length > 0 ? trimmed : '';
  }, [imageObjectUrl, imageUrl]);

  const hasImageUrl = imageUrl.trim().length > 0;
  const hasImageFile = Boolean(imageFile);
  const hasImage = hasImageUrl || hasImageFile;
  const hasEmoji = avatarEmoji.trim().length > 0;

  function markDirty() {
    setDirty(true);
    setSaveError(null);
  }

  function handleFilePick(file: File | null) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setSaveError('Only PNG, JPG, and WEBP files are supported.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSaveError('Image must be under 2MB.');
      return;
    }
    setImageFile(file);
    setPreviewFailed(false);
    markDirty();
  }

  function handleRemoveAvatar() {
    setImageFile(null);
    setImageUrl('');
    setAvatarEmoji('');
    setShowImageUrlField(false);
    setPreviewFailed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    markDirty();
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!bot || !botId || saving) return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setSaveError('Bot name is required.');
      return;
    }
    if (!trimmedDescription) {
      setSaveError('Description is required.');
      return;
    }
    if (hasImageFile && !hasImageUrl) {
      setSaveError(
        'Avatar uploads are not yet available in the customer workspace. Paste a hosted image URL or set an emoji avatar.',
      );
      return;
    }

    setSaving(true);
    setSaveError(null);

    const payload: Record<string, unknown> = {
      ...preserveUneditedBotFields(bot),
      name: trimmedName,
      shortDescription: tagline.trim(),
      description: trimmedDescription,
      imageUrl: imageUrl.trim(),
      avatarEmoji: avatarEmoji.trim(),
      includeNameInKnowledge,
    };

    const res = await patchCustomerBot(botId, payload);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setDirty(false);
    setSaveError(null);
    await reload();
  }

  if (!bot || !botId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-profile-editor>
      <form
        id="profile-editor-form"
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSave(e)}
        aria-label="Profile settings"
      >
        <div className="w-full min-w-0 flex-1">
          {/* Page heading */}
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200/70 pb-3">
            <div className="min-w-0">
              <h1 className="m-0 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">Profile</h1>
              <p className="mb-0 mt-0.5 text-[0.8125rem] leading-snug text-slate-500">
                Name, description, and avatar for the widget.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {widgetPreviewShell?.showHeaderPreviewTrigger && widgetPreviewShell.headerPreviewLabel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[0.75rem] font-medium text-slate-600"
                  onClick={() => widgetPreviewShell.openPreview()}
                >
                  <Eye size={14} strokeWidth={1.75} aria-hidden />
                  {widgetPreviewShell.headerPreviewLabel}
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className="h-7 shrink-0 gap-1.5 px-2.5 text-[0.75rem] font-medium"
                aria-busy={saving || undefined}
                aria-label={saving ? 'Saving profile' : `Save ${PROFILE_SECTION_NAV_LABEL}`}
              >
                {saving ? (
                  <>
                    <Loader2 size={14} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} strokeWidth={2} aria-hidden />
                    Save {PROFILE_SECTION_NAV_LABEL}
                  </>
                )}
              </Button>
            </div>
          </div>

          {saveError ? (
            <div className="mb-3 rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3 py-2 text-[0.8125rem] text-[var(--color-danger-text-emphasis)]">
              {saveError}
            </div>
          ) : null}

          <div className="flex w-full min-w-0 flex-col gap-3">
            <Card className="w-full min-w-0 border border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="gap-0.5 border-b border-slate-100 px-4 py-3 sm:px-5">
                <CardTitle className="text-[0.9375rem] font-semibold">Identity</CardTitle>
                <CardDescription className="text-[0.8125rem] leading-snug text-slate-500">
                  Chat header and public profile.
                </CardDescription>
              </CardHeader>
              <CardBody className="w-full min-w-0 space-y-0 px-4 pb-4 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
                <div className="grid w-full min-w-0 grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                  <FieldRow label="Bot name" htmlFor="profile-bot-name" required className="min-w-0 gap-1">
                    <Input
                      id="profile-bot-name"
                      quiet
                      value={name}
                      placeholder="AI Support Assistant"
                      onChange={(e) => {
                        setName(e.target.value);
                        markDirty();
                      }}
                      required
                    />
                  </FieldRow>

                  <FieldRow label="Tagline" htmlFor="profile-tagline" className="min-w-0 gap-1">
                    <Input
                      id="profile-tagline"
                      quiet
                      value={tagline}
                      placeholder="Instant answers to your questions"
                      onChange={(e) => {
                        setTagline(e.target.value);
                        markDirty();
                      }}
                    />
                  </FieldRow>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex min-w-0 cursor-pointer items-start gap-2.5">
                      <Checkbox
                        className="mt-0.5"
                        checked={includeNameInKnowledge}
                        onChange={(e) => {
                          setIncludeNameInKnowledge(e.currentTarget.checked);
                          markDirty();
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[0.8125rem] font-medium leading-snug text-slate-800">
                          Include in knowledge base
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] leading-snug text-slate-500">
                          Exposes the bot name to the model when useful.
                        </span>
                      </span>
                    </label>
                    <Tooltip content="Adds the bot name to the knowledge layer.">
                      <button
                        type="button"
                        className="mt-0.5 inline-flex shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        aria-label="About this setting"
                      >
                        <Info size={15} strokeWidth={1.75} aria-hidden />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <FieldRow
                  label="Description"
                  htmlFor="profile-description"
                  required
                  className="mt-3 gap-1 border-t border-slate-100 pt-3"
                >
                  <Textarea
                    id="profile-description"
                    quiet
                    rows={3}
                    value={description}
                    className="resize-y py-2 text-[0.8125rem] leading-relaxed text-slate-900 placeholder:text-slate-400"
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markDirty();
                    }}
                  />
                </FieldRow>
              </CardBody>
            </Card>

            <Card className="w-full min-w-0 border border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="gap-0.5 border-b border-slate-100 px-4 py-3 sm:px-5">
                <CardTitle className="text-[0.9375rem] font-semibold">Avatar</CardTitle>
                <CardDescription className="text-[0.8125rem] leading-snug text-slate-500">
                  Upload or drop an image to preview. To save, use a hosted URL (below) or an emoji.
                </CardDescription>
              </CardHeader>
              <CardBody className="w-full min-w-0 px-4 pb-4 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
                <div className="grid w-full min-w-0 grid-cols-1 gap-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start lg:gap-8">
                  <div className="flex flex-col lg:sticky lg:top-2">
                    <div
                      className={cn(
                        'relative mx-auto flex aspect-square w-full max-w-[12rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_1px_2px_rgba(15,23,42,0.04)] lg:mx-0 lg:max-w-none',
                      )}
                    >
                      {hasImage || hasEmoji ? (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          aria-label="Remove avatar"
                          className="absolute right-2 top-2 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-500 shadow-sm backdrop-blur-[2px] transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
                        >
                          <X size={12} strokeWidth={2.25} aria-hidden />
                        </button>
                      ) : null}
                      {previewSrc && isSafeImageSrc(previewSrc) && !previewFailed ? (
                        <img
                          src={previewSrc}
                          alt=""
                          className="h-[5rem] w-[5rem] rounded-[0.875rem] border border-white object-cover shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.06]"
                          onError={() => setPreviewFailed(true)}
                        />
                      ) : hasEmoji && !previewSrc ? (
                        <div
                          className="flex h-[5rem] w-[5rem] items-center justify-center rounded-[0.875rem] border border-slate-200/70 bg-white text-[2.125rem] leading-none shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
                          aria-hidden
                        >
                          {avatarEmoji.trim()}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 px-4 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-300/70 bg-white/80">
                            <UserRound size={22} strokeWidth={1.5} className="text-slate-400" aria-hidden />
                          </div>
                          <p className="m-0 text-[0.6875rem] font-medium text-slate-500">No avatar</p>
                          <p className="m-0 text-[0.625rem] leading-snug text-slate-400">Preview updates live</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-3">
                    <div>
                      <p className="mb-1.5 text-[0.8125rem] font-medium text-slate-800">Image</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                        disabled={hasImageUrl}
                      />
                      <div
                        role="button"
                        tabIndex={hasImageUrl ? -1 : 0}
                        aria-disabled={hasImageUrl || undefined}
                        onClick={() => {
                          if (!hasImageUrl) fileInputRef.current?.click();
                        }}
                        onKeyDown={(e) => {
                          if (hasImageUrl) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => {
                          if (hasImageUrl) return;
                          e.preventDefault();
                          setDragOver(true);
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => {
                          if (hasImageUrl) return;
                          e.preventDefault();
                          setDragOver(false);
                          handleFilePick(e.dataTransfer.files?.[0] ?? null);
                        }}
                        className={cn(
                          'cursor-pointer rounded-lg border bg-white px-3 py-3 transition-colors sm:min-h-[5.25rem] sm:py-4',
                          hasImageUrl
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                            : dragOver
                              ? 'border-slate-400/60 bg-slate-50/80 shadow-[0_0_0_2px_rgba(15,23,42,0.06)]'
                              : 'border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/40',
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-white',
                              hasImageUrl ? 'border-slate-200 bg-slate-100 text-slate-300' : 'text-slate-500',
                            )}
                          >
                            <ImageUp size={16} strokeWidth={1.75} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="m-0 text-[0.8125rem] font-medium text-slate-800">
                              {imageFile ? imageFile.name : 'Drop an image here, or click to browse'}
                            </p>
                            <p className="mb-0 mt-0.5 text-[0.6875rem] leading-snug text-slate-500">
                              {hasImageUrl
                                ? 'Clear the URL below to upload a file.'
                                : imageFile
                                  ? 'Preview only — add a URL to save this image.'
                                  : 'PNG, JPG, or WebP · max 2MB'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {showImageUrlField ? (
                      <div className="space-y-2">
                        <FieldRow
                          label="Image URL"
                          htmlFor="profile-image-url"
                          className="min-w-0 gap-1"
                          disabled={hasImageFile}
                          disabledNote={hasImageFile ? 'Remove the selected file to edit the URL.' : undefined}
                        >
                          <Input
                            id="profile-image-url"
                            quiet
                            type="text"
                            inputMode="url"
                            autoComplete="off"
                            placeholder="https://…"
                            value={imageUrl}
                            disabled={hasImageFile}
                            leadingIcon={<Link2 size={16} strokeWidth={1.75} className="text-slate-500" aria-hidden />}
                            clearable
                            onClear={() => {
                              setImageUrl('');
                              setPreviewFailed(false);
                              markDirty();
                            }}
                            onChange={(e) => {
                              setImageUrl(e.target.value);
                              setPreviewFailed(false);
                              markDirty();
                            }}
                          />
                        </FieldRow>
                        {!hasImageUrl ? (
                          <button
                            type="button"
                            className="text-left text-[0.75rem] font-medium text-slate-500 underline decoration-slate-300/80 underline-offset-2 transition hover:text-slate-800"
                            onClick={() => setShowImageUrlField(false)}
                          >
                            Prefer file upload
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-left text-[0.8125rem] font-medium text-slate-600 underline decoration-slate-300/90 underline-offset-2 transition hover:text-slate-900"
                        onClick={() => setShowImageUrlField(true)}
                      >
                        Use image URL instead
                      </button>
                    )}

                    <div className="border-t border-dashed border-slate-200/90 pt-3">
                      <FieldRow
                        label="Emoji (optional)"
                        htmlFor="profile-avatar-emoji"
                        className="min-w-0 gap-1 opacity-90"
                      >
                        <Input
                          id="profile-avatar-emoji"
                          quiet
                          inputSize="sm"
                          value={avatarEmoji}
                          placeholder="e.g. 🤖"
                          maxLength={MAX_EMOJI_LEN}
                          wrapperClassName="w-full max-w-[10.5rem]"
                          leadingIcon={<Smile size={14} strokeWidth={1.75} className="text-slate-400" aria-hidden />}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => {
                            const v = e.target.value.slice(0, MAX_EMOJI_LEN);
                            setAvatarEmoji(v);
                            markDirty();
                          }}
                        />
                      </FieldRow>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
