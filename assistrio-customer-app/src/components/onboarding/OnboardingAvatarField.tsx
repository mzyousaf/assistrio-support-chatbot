import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Smile, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import {
  clampAvatarEmojiInput,
  inferBotAvatarSource,
  isLegacyStockAssistrioAvatarUrl,
  isUserUploadedAvatarUrl,
  type BotAvatarSource,
} from '@/lib/botAvatarDisplay';
import type { CustomerBotDetail, WorkspaceOnboardingDraftProfile } from '@/api/types';

const COMMON_AVATAR_EMOJIS = [
  '🤖', '💬', '✨', '⭐', '🎯', '💡', '🛟', '🙂', '😊', '👋', '🚀', '📚', '🔧', '❤️',
] as const;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const SAFE_IMAGE_PROTOCOL = /^(https?:|data:image\/)/i;

function isSafeImageSrc(src: string) {
  if (!src) return false;
  return SAFE_IMAGE_PROTOCOL.test(src.trim());
}

export type OnboardingAvatarState = {
  imageUrl: string;
  avatarEmoji: string;
  avatarSource: BotAvatarSource;
  pendingFile: File | null;
};

export function onboardingAvatarStateFromDraft(
  profile: WorkspaceOnboardingDraftProfile | null | undefined,
): OnboardingAvatarState {
  if (!profile) {
    return { imageUrl: '', avatarEmoji: '', avatarSource: 'none', pendingFile: null };
  }
  const sourceRaw = String(profile.avatarSource ?? '').trim().toLowerCase();
  const source =
    sourceRaw === 'upload' || sourceRaw === 'url' || sourceRaw === 'emoji' || sourceRaw === 'none'
      ? (sourceRaw as BotAvatarSource)
      : inferBotAvatarSource({
          imageUrl: profile.imageUrl,
          avatarEmoji: profile.avatarEmoji,
          avatarSource: profile.avatarSource,
        } as CustomerBotDetail);
  return {
    imageUrl: String(profile.imageUrl ?? ''),
    avatarEmoji: String(profile.avatarEmoji ?? ''),
    avatarSource: source,
    pendingFile: null,
  };
}

type Props = {
  value: OnboardingAvatarState;
  onChange: (next: OnboardingAvatarState) => void;
  disabled?: boolean;
  error?: string | null;
  /** Botless onboarding: hide file upload until avatar staging exists. */
  disableFileUpload?: boolean;
  fileUploadNote?: string;
};

export function onboardingAvatarStateFromBot(bot: CustomerBotDetail | null): OnboardingAvatarState {
  if (!bot) {
    return { imageUrl: '', avatarEmoji: '', avatarSource: 'none', pendingFile: null };
  }
  return {
    imageUrl: String(bot.imageUrl ?? ''),
    avatarEmoji: String(bot.avatarEmoji ?? ''),
    avatarSource: inferBotAvatarSource(bot),
    pendingFile: null,
  };
}

export function OnboardingAvatarField({
  value,
  onChange,
  disabled,
  error,
  disableFileUpload = false,
  fileUploadNote = 'Image upload will be available after setup.',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const uploadId = useId();
  const emojiId = useId();

  useLayoutEffect(() => {
    if (!value.pendingFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.pendingFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.pendingFile]);

  const preview = useMemo(() => {
    if (imageObjectUrl) {
      return { kind: 'image' as const, src: imageObjectUrl };
    }
    const emoji = clampAvatarEmojiInput(value.avatarEmoji);
    if (value.avatarSource === 'emoji' && emoji) {
      return { kind: 'emoji' as const, emoji };
    }
    const url = value.imageUrl.trim();
    if (
      url &&
      !(isLegacyStockAssistrioAvatarUrl(url) && !isUserUploadedAvatarUrl(url)) &&
      isSafeImageSrc(url)
    ) {
      return { kind: 'image' as const, src: url };
    }
    return { kind: 'empty' as const };
  }, [imageObjectUrl, value.avatarSource, value.avatarEmoji, value.imageUrl]);

  function patch(partial: Partial<OnboardingAvatarState>) {
    onChange({ ...value, ...partial });
    setLocalError(null);
  }

  function handleFilePick(file: File | null) {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setLocalError('Only PNG, JPG, and WEBP files are supported.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setLocalError('Image must be under 2MB.');
      return;
    }
    patch({
      pendingFile: file,
      avatarSource: 'upload',
      avatarEmoji: '',
    });
    setPreviewFailed(false);
  }

  function handleRemove() {
    patch({
      pendingFile: null,
      imageUrl: '',
      avatarEmoji: '',
      avatarSource: 'none',
    });
    setPreviewFailed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleEmojiPick(ch: string) {
    patch({
      pendingFile: null,
      avatarEmoji: ch,
      avatarSource: 'emoji',
      imageUrl: '',
    });
    setPreviewFailed(false);
  }

  const showImage = preview.kind === 'image' && !previewFailed;
  const showEmoji = preview.kind === 'emoji';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cn(
            'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-3xl',
            !showImage && !showEmoji && 'border-dashed text-slate-300',
          )}
          aria-hidden={!showImage && !showEmoji}
        >
          {showImage ? (
            <img
              src={preview.src}
              alt=""
              className="size-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : showEmoji ? (
            <span aria-hidden>{preview.emoji}</span>
          ) : (
            <Smile className="size-8 stroke-[1.25]" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="m-0 text-[0.75rem] leading-snug text-slate-500">
            {disableFileUpload
              ? fileUploadNote
              : 'Upload an image or pick an emoji. Optional — you can change this later in workspace settings.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!disableFileUpload ? (
              <>
                <input
                  ref={fileInputRef}
                  id={uploadId}
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  className="sr-only"
                  disabled={disabled}
                  onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => fileInputRef.current?.click()}
                >
              <ImagePlus className="size-3.5" aria-hidden />
              Upload image
            </Button>
            {(showImage || showEmoji || value.pendingFile) && !disableFileUpload ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </Button>
            ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={emojiId} className="text-[0.8125rem] font-medium text-slate-700">
          Or choose an emoji
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_AVATAR_EMOJIS.map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={disabled}
              className={cn(
                'flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white text-lg transition-colors hover:border-primary hover:bg-slate-50',
                value.avatarSource === 'emoji' && clampAvatarEmojiInput(value.avatarEmoji) === ch &&
                  'border-primary bg-[var(--teal-50)]',
              )}
              aria-label={`Use ${ch} as avatar`}
              onClick={() => handleEmojiPick(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
        <Input
          id={emojiId}
          quiet
          value={value.avatarEmoji}
          disabled={disabled}
          placeholder="Type an emoji"
          onChange={(e) => {
            const em = clampAvatarEmojiInput(e.target.value);
            if (!em) {
              patch({ avatarEmoji: '', avatarSource: value.pendingFile ? 'upload' : 'none' });
              return;
            }
            patch({ pendingFile: null, avatarEmoji: em, avatarSource: 'emoji', imageUrl: '' });
          }}
        />
      </div>

      {localError || error ? (
        <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {localError ?? error}
        </p>
      ) : null}
    </div>
  );
}
