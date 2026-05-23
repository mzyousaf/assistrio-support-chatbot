import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bot, Camera, Loader2, Trash2, User, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import {
  inferBotAvatarSource,
  isLegacyStockAssistrioAvatarUrl,
  isUserUploadedAvatarUrl,
  type BotAvatarSource,
} from '@/lib/botAvatarDisplay';
import type { CustomerBotDetail, WorkspaceOnboardingDraftProfile } from '@/api/types';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const SAFE_IMAGE_PROTOCOL = /^(https?:|data:image\/)/i;

function isSafeImageSrc(src: string) {
  if (!src) return false;
  return SAFE_IMAGE_PROTOCOL.test(src.trim());
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export type AgentAvatarState = {
  imageUrl: string;
  avatarEmoji: string;
  avatarSource: BotAvatarSource;
  pendingFile: File | null;
};

export function agentAvatarStateFromDraft(
  profile: WorkspaceOnboardingDraftProfile | null | undefined,
): AgentAvatarState {
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
    avatarEmoji: '',
    avatarSource: source === 'emoji' ? 'none' : source,
    pendingFile: null,
  };
}

type Props = {
  value: AgentAvatarState;
  onChange: (next: AgentAvatarState) => void;
  onUploadFile?: (file: File) => Promise<{ ok: true } | { ok: false; error: string }>;
  disabled?: boolean;
  error?: string | null;
  agentName?: string;
  /** Compact horizontal layout for onboarding. */
  layout?: 'default' | 'compact';
};

export function AgentAvatarField({
  value,
  onChange,
  onUploadFile,
  disabled,
  error,
  agentName = '',
  layout = 'default',
}: Props) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    if (!value.pendingFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.pendingFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.pendingFile]);

  useLayoutEffect(() => {
    setPreviewFailed(false);
  }, [imageObjectUrl, value.imageUrl]);

  const preview = useMemo(() => {
    if (imageObjectUrl) return { kind: 'image' as const, src: imageObjectUrl };
    const url = value.imageUrl.trim();
    if (
      url &&
      !(isLegacyStockAssistrioAvatarUrl(url) && !isUserUploadedAvatarUrl(url)) &&
      isSafeImageSrc(url)
    ) {
      return { kind: 'image' as const, src: url };
    }
    const initials = initialsFromName(agentName);
    if (initials) return { kind: 'initials' as const, initials };
    return { kind: 'empty' as const };
  }, [imageObjectUrl, value.imageUrl, agentName]);

  const showImagePreview = preview.kind === 'image' && !previewFailed;
  const hasAvatarImage = showImagePreview;
  const busy = disabled || uploading;

  function patch(partial: Partial<AgentAvatarState>) {
    onChange({ ...value, ...partial });
    setLocalError(null);
  }

  async function handleFilePick(file: File | null) {
    if (!file || busy) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setLocalError('Only PNG, JPG, and WEBP files are supported.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setLocalError('Image must be under 2MB.');
      return;
    }

    setPreviewFailed(false);

    if (onUploadFile) {
      setUploading(true);
      const res = await onUploadFile(file);
      setUploading(false);
      if (!res.ok) {
        setLocalError(res.error);
        return;
      }
      // Parent upload handler merges avatar fields from the API; only clear local pending file.
      patch({ pendingFile: null });
      return;
    }

    patch({ pendingFile: file, avatarSource: 'upload', avatarEmoji: '' });
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    patch({
      pendingFile: null,
      imageUrl: '',
      avatarEmoji: '',
      avatarSource: 'none',
    });
    setPreviewFailed(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (layout === 'compact') {
    return (
      <div className="flex flex-col gap-2">
        <input
          ref={fileInputRef}
          id={fileInputId}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void handleFilePick(e.target.files?.[0] ?? null)}
        />

        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] bg-[var(--ui-surface-muted)]">
              {uploading ? (
                <Loader2 className="size-6 animate-spin text-[var(--color-text-muted)]" aria-hidden />
              ) : showImagePreview ? (
                <img
                  src={preview.src}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setPreviewFailed(true)}
                />
              ) : preview.kind === 'initials' ? (
                <span className="text-lg font-semibold text-[var(--color-text-secondary)]">{preview.initials}</span>
              ) : (
                <Bot className="size-8 text-[var(--color-teal-600)]/75" strokeWidth={1.5} aria-hidden />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <p className="m-0 text-[0.8125rem] font-medium text-[var(--color-text-primary)]">Avatar</p>
            <p className="m-0 mt-1 text-[0.75rem] leading-snug text-[var(--color-text-secondary)]">
              PNG, JPG, or WEBP up to 2 MB. Add an image for your AI agent.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-3.5" aria-hidden />
                {hasAvatarImage ? 'Change' : 'Upload'}
              </Button>
              {hasAvatarImage && !uploading ? (
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={handleRemove}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {localError || error ? (
          <p className="m-0 text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
            {localError ?? error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(e) => void handleFilePick(e.target.files?.[0] ?? null)}
      />

      <div className="relative inline-flex">
        <button
          type="button"
          disabled={busy}
          aria-label="Upload agent avatar"
          title="Upload agent avatar"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 transition-colors',
            'hover:border-slate-300 hover:bg-slate-100/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            busy && 'cursor-not-allowed opacity-60',
          )}
        >
          {uploading ? (
            <Loader2 className="size-7 animate-spin text-slate-400" aria-hidden />
          ) : showImagePreview ? (
            <img
              src={preview.src}
              alt=""
              className="size-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : preview.kind === 'initials' ? (
            <span className="text-xl font-semibold tracking-tight text-slate-500">{preview.initials}</span>
          ) : (
            <User className="size-9 text-slate-300" strokeWidth={1.5} aria-hidden />
          )}

          {!uploading ? (
            <span
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/0 transition-colors',
                'group-hover:bg-slate-900/40 group-focus-visible:bg-slate-900/40',
              )}
              aria-hidden
            >
              <Camera
                className="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                strokeWidth={2}
              />
            </span>
          ) : null}
        </button>

        {hasAvatarImage && !uploading ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            aria-label="Remove agent avatar"
            title="Remove agent avatar"
            className="absolute -bottom-0.5 -right-0.5 inline-flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-[var(--color-danger-text-emphasis)] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="m-0 max-w-[11rem] text-[0.6875rem] leading-snug text-slate-500">
        Upload a logo or image that represents your agent.
      </p>

      {localError || error ? (
        <p className="m-0 max-w-xs text-[0.75rem] leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {localError ?? error}
        </p>
      ) : null}
    </div>
  );
}

export function resolveAgentAvatarPayload(avatar: AgentAvatarState): {
  imageUrl: string;
  avatarEmoji: string;
  avatarSource: string;
  avatarStorageKey?: string;
} {
  if (avatar.avatarSource === 'none') {
    return { imageUrl: '', avatarEmoji: '', avatarSource: 'none', avatarStorageKey: '' };
  }
  return {
    imageUrl: avatar.imageUrl.trim(),
    avatarEmoji: '',
    avatarSource: avatar.avatarSource === 'emoji' ? 'none' : avatar.avatarSource,
  };
}
