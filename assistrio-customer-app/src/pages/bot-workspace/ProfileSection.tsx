import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Info,
  Link2,
  Loader2,
  Save,
  Smile,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { patchCustomerBot, postCustomerBotAvatar } from '../../api/customerApi';
import type { CustomerBotDetail } from '../../api/types';
import { useBotWorkspace } from './BotWorkspaceContext';
import { useCustomerWidgetPreview } from './CustomerWidgetPreviewContext';
import { registerManualSaveGuard } from './workspaceManualSaveGuard';
import { Button, Card, CardBody, Checkbox, FieldRow, Input, Modal, Textarea, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  clampAvatarEmojiInput,
  inferBotAvatarSource,
  isLegacyStockAssistrioAvatarUrl,
  isUserUploadedAvatarUrl,
} from '@/lib/botAvatarDisplay';
import { WorkspaceSectionHeader } from './WorkspaceSectionHeader';
import { ws } from './workspace';

const COMMON_AVATAR_EMOJIS = [
  '🤖', '💬', '✨', '⭐', '🎯', '🧭', '💡', '🔔', '📌', '🛟', '📣', '✅', '🔧', '🙂', '😊', '👋', '🙌', '👍', '✋',
  '🎉', '🔥', '💎', '🚀', '🛡️', '📚', '📝', '🔍', '❤️', '🌐', '☀️', '🌙', '☁️', '⚡', '🎨', '🧩', '📊', '🤝', '🏠', '✈️',
] as const;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const SAFE_IMAGE_PROTOCOL = /^(https?:|data:image\/)/i;

/** Matches left avatar preview (square with rounded corners); right column tabs use the same height on `md+`. */
const AVATAR_PREVIEW_SIZE_CLASS = 'size-[16rem]';

/** Matches `AgentWorkspaceSidebar` label for this route (`playground/profile`). */
const PROFILE_SECTION_NAV_LABEL = 'Profile';

const PROFILE_PREVIEW_DEBOUNCE_MS = 150;

type AvatarTab = 'upload' | 'url' | 'emoji';

type AvatarSource = 'upload' | 'url' | 'emoji' | 'none';

type BotWithExtras = CustomerBotDetail;

function isSafeImageSrc(src: string) {
  if (!src) return false;
  return SAFE_IMAGE_PROTOCOL.test(src.trim());
}

/** Which editor tab to show on load from saved bot (tabs do not affect saved avatarSource). */
function inferAvatarTab(b: BotWithExtras): AvatarTab {
  const mode = inferBotAvatarSource(b);
  if (mode === 'emoji') return 'emoji';
  if (mode === 'url') return 'url';
  return 'upload';
}

export function ProfileSection() {
  const { bot, botId, softReload } = useBotWorkspace();
  const { setProfileDraftSlice } = useCustomerWidgetPreview();
  const knowledgeCheckboxId = useId();
  const avatarTabsId = useId();

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
  const [avatarTab, setAvatarTab] = useState<AvatarTab>('upload');
  /** What the avatar is (preview + save), independent of which editor tab is selected. */
  const [avatarIdentity, setAvatarIdentity] = useState<AvatarSource>('none');

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemoveAvatarOpen, setConfirmRemoveAvatarOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerWrapRef = useRef<HTMLDivElement>(null);
  const emojiPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const emojiPickerPopoverRef = useRef<HTMLDivElement>(null);
  const [emojiPickerPos, setEmojiPickerPos] = useState<{ top: number; left: number } | null>(null);
  /** Last known user-upload asset (`/uploads/bot-avatars/`) — used when URL mode has a bad URL (preview + save fallback). */
  const [uploadedImageFallbackUrl, setUploadedImageFallbackUrl] = useState('');
  const [imgUrlLoadFellBack, setImgUrlLoadFellBack] = useState(false);

  /** Reset local avatar fields to match last saved `bot` (file preview, URL, emoji, fallbacks). */
  const applySavedBotAvatarFields = useCallback((b: BotWithExtras) => {
    const nextUrl = String(b.imageUrl ?? '');
    setImageUrl(nextUrl);
    setAvatarEmoji(String(b.avatarEmoji ?? ''));
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setPreviewFailed(false);
    setImgUrlLoadFellBack(false);
    setAvatarIdentity(inferBotAvatarSource(b));
    setUploadedImageFallbackUrl(isUserUploadedAvatarUrl(nextUrl) ? nextUrl : '');
  }, []);

  const discardProfile = useCallback(() => {
    if (!bot) return;
    const b = bot as BotWithExtras;
    setName(String(b.name ?? ''));
    setTagline(String(b.shortDescription ?? ''));
    setDescription(String(b.description ?? ''));
    setIncludeNameInKnowledge(b.includeNameInKnowledge === true);
    applySavedBotAvatarFields(b);
    setDirty(false);
    setSaveError(null);
    setAvatarTab(inferAvatarTab(b));
  }, [bot, applySavedBotAvatarFields]);

  /**
   * Re-applies avatar from last saved `bot` (image URL, emoji, upload fallback, clears unsaved file).
   * Used when switching Upload / URL / Emoji tabs, or when clearing the URL or emoji field—shows last saved image/emoji if any.
   */
  const syncAvatarFromSavedBot = useCallback(() => {
    if (!bot) return;
    const b = bot as BotWithExtras;
    applySavedBotAvatarFields(b);
    setEmojiPickerOpen(false);
    const stillDirty =
      name.trim() !== String(b.name ?? '').trim() ||
      tagline.trim() !== String(b.shortDescription ?? '').trim() ||
      description.trim() !== String(b.description ?? '').trim() ||
      includeNameInKnowledge !== (b.includeNameInKnowledge === true);
    setDirty(stillDirty);
    if (!stillDirty) setSaveError(null);
  }, [bot, applySavedBotAvatarFields, name, tagline, description, includeNameInKnowledge]);

  /** Do not overwrite local edits (e.g. removed avatar before save) when `bot` refetches in the background. */
  useEffect(() => {
    if (dirty) return;
    discardProfile();
  }, [discardProfile, dirty]);

  useEffect(() => {
    return registerManualSaveGuard('profile', () => dirty, discardProfile);
  }, [dirty, discardProfile]);

  useLayoutEffect(() => {
    if (!emojiPickerOpen) {
      setEmojiPickerPos(null);
      return;
    }
    const el = emojiPickerTriggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = 280;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8));
    setEmojiPickerPos({ top: r.bottom + 8, left });
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    function place() {
      const el = emojiPickerTriggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panelW = 280;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - panelW - 8));
      setEmojiPickerPos({ top: r.bottom + 8, left });
    }
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [emojiPickerOpen]);

  useEffect(() => {
    if (!emojiPickerOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (emojiPickerTriggerRef.current?.contains(t)) return;
      if (emojiPickerPopoverRef.current?.contains(t)) return;
      setEmojiPickerOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [emojiPickerOpen]);

  /** `useLayoutEffect` so the blob URL exists before paint — avoids one frame with a file picked but no preview (flash). */
  useLayoutEffect(() => {
    if (!imageFile) {
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  /** Keep upload fallback in sync whenever the hosted URL is a user-upload asset. */
  useEffect(() => {
    const t = imageUrl.trim();
    if (isUserUploadedAvatarUrl(t)) setUploadedImageFallbackUrl(t);
  }, [imageUrl]);

  useEffect(() => {
    setImgUrlLoadFellBack(false);
  }, [imageUrl, avatarIdentity]);

  /**
   * Display order (independent of active tab): pending local file → image (upload/url + imageUrl) → emoji → empty.
   * URL mode: invalid/unsafe URL falls back to `uploadedImageFallbackUrl` when set (saved upload).
   */
  const avatarPreview = useMemo(() => {
    if (imageObjectUrl) {
      return { kind: 'pendingFile' as const, src: imageObjectUrl };
    }
    const url = imageUrl.trim();
    const fb = uploadedImageFallbackUrl.trim();
    const em = clampAvatarEmojiInput(avatarEmoji);

    if (avatarIdentity === 'emoji') {
      if (em.length) return { kind: 'emoji' as const, emoji: em };
      return { kind: 'empty' as const };
    }
    if (avatarIdentity === 'upload') {
      if (!url) return { kind: 'empty' as const };
      if (isLegacyStockAssistrioAvatarUrl(url) && !isUserUploadedAvatarUrl(url)) return { kind: 'empty' as const };
      if (!isSafeImageSrc(url)) return { kind: 'empty' as const };
      return { kind: 'image' as const, src: url };
    }
    if (avatarIdentity === 'url') {
      const primaryOk =
        url.length > 0 &&
        !(isLegacyStockAssistrioAvatarUrl(url) && !isUserUploadedAvatarUrl(url)) &&
        isSafeImageSrc(url);
      const fallbackOk = fb.length > 0 && isUserUploadedAvatarUrl(fb) && isSafeImageSrc(fb);

      if (primaryOk && !imgUrlLoadFellBack) {
        return { kind: 'image' as const, src: url };
      }
      if (fallbackOk && (!primaryOk || imgUrlLoadFellBack)) {
        return { kind: 'image' as const, src: fb };
      }
      return { kind: 'empty' as const };
    }
    return { kind: 'empty' as const };
  }, [
    imageObjectUrl,
    avatarIdentity,
    imageUrl,
    avatarEmoji,
    uploadedImageFallbackUrl,
    imgUrlLoadFellBack,
  ]);

  useEffect(() => {
    const avatarUrl =
      avatarPreview.kind === 'pendingFile' || avatarPreview.kind === 'image' ? avatarPreview.src : '';
    const avatarEmojiDraft = avatarPreview.kind === 'emoji' ? avatarPreview.emoji : '';
    const id = window.setTimeout(() => {
      setProfileDraftSlice({
        botName: name,
        tagline,
        description,
        avatarUrl,
        avatarEmoji: avatarEmojiDraft,
      });
    }, PROFILE_PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [avatarPreview, name, tagline, description, setProfileDraftSlice]);

  useEffect(() => {
    return () => setProfileDraftSlice(null);
  }, [setProfileDraftSlice]);

  const showImagePreview =
    (avatarPreview.kind === 'pendingFile' || avatarPreview.kind === 'image') && !previewFailed;
  const previewSrc =
    avatarPreview.kind === 'pendingFile' || avatarPreview.kind === 'image' ? avatarPreview.src : '';

  /** New `src`: reset decode error; avoid showing stale broken state while the next image loads. */
  useLayoutEffect(() => {
    if (!previewSrc) return;
    setPreviewFailed(false);
  }, [previewSrc]);

  const showEmojiPreview = avatarPreview.kind === 'emoji';
  const hasAvatarContent = avatarPreview.kind !== 'empty';
  const hasImageFile = Boolean(imageFile);

  /** When source is upload, do not surface hosted URL or emoji in other tabs—only Upload applies. State keeps `imageUrl` for preview/save. */
  const urlFieldDisplayValue = useMemo(() => {
    if (avatarIdentity === 'upload') return '';
    const raw = imageUrl.trim();
    if (isLegacyStockAssistrioAvatarUrl(raw) && !isUserUploadedAvatarUrl(raw)) return '';
    return imageUrl;
  }, [avatarIdentity, imageUrl]);

  const emojiFieldDisplayValue = useMemo(() => {
    if (avatarIdentity === 'upload') return '';
    return avatarEmoji;
  }, [avatarIdentity, avatarEmoji]);

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
    setAvatarIdentity('upload');
    setAvatarEmoji('');
    setPreviewFailed(false);
    markDirty();
  }

  function handleRemoveAvatar() {
    setImageFile(null);
    setImageUrl('');
    setAvatarEmoji('');
    setPreviewFailed(false);
    setUploadedImageFallbackUrl('');
    setImgUrlLoadFellBack(false);
    setAvatarIdentity('none');
    setAvatarTab('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
    markDirty();
    setConfirmRemoveAvatarOpen(false);
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!bot || !botId || saving) return;

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    if (!trimmedName) {
      setSaveError('Agent name is required.');
      return;
    }
    if (!trimmedDescription) {
      setSaveError('Description is required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    let persistedImageUrl = imageUrl.trim();
    let persistedEmoji = clampAvatarEmojiInput(avatarEmoji);
    let avatarSource: AvatarSource = 'none';

    if (imageFile) {
      const fd = new FormData();
      fd.append('file', imageFile);
      const up = await postCustomerBotAvatar(botId, fd);
      if (!up.ok) {
        setSaving(false);
        setSaveError(up.error);
        return;
      }
      persistedImageUrl = up.data.url;
      persistedEmoji = '';
      avatarSource = 'upload';
    } else if (avatarIdentity === 'emoji') {
      persistedImageUrl = '';
      avatarSource = persistedEmoji ? 'emoji' : 'none';
    } else if (avatarIdentity === 'url') {
      persistedEmoji = '';
      const fb = uploadedImageFallbackUrl.trim();
      const p = persistedImageUrl;
      const primaryLooksLikeUrl =
        p.length > 0 &&
        isSafeImageSrc(p) &&
        !(isLegacyStockAssistrioAvatarUrl(p) && !isUserUploadedAvatarUrl(p));

      if (primaryLooksLikeUrl) {
        avatarSource = 'url';
      } else if (fb && isUserUploadedAvatarUrl(fb) && isSafeImageSrc(fb)) {
        persistedImageUrl = fb;
        avatarSource = 'upload';
      } else if (p.length > 0 && !isSafeImageSrc(p)) {
        setSaving(false);
        setSaveError('Image URL must start with https:// or http:// (or use Upload / Emoji).');
        return;
      } else {
        persistedImageUrl = '';
        avatarSource = 'none';
      }
    } else if (avatarIdentity === 'upload') {
      persistedEmoji = '';
      if (
        persistedImageUrl &&
        !(isLegacyStockAssistrioAvatarUrl(persistedImageUrl) && !isUserUploadedAvatarUrl(persistedImageUrl))
      ) {
        if (!isSafeImageSrc(persistedImageUrl)) {
          setSaving(false);
          setSaveError('Image URL must start with https:// or http:// (or use Upload / Emoji).');
          return;
        }
        avatarSource = 'upload';
      } else {
        avatarSource = 'none';
      }
    } else {
      persistedEmoji = '';
      avatarSource = 'none';
    }

    const res = await patchCustomerBot(botId, {
      name: trimmedName,
      shortDescription: tagline.trim(),
      description: trimmedDescription,
      imageUrl: persistedImageUrl,
      avatarEmoji: persistedEmoji,
      avatarSource,
      includeNameInKnowledge,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return;
    }
    setDirty(false);
    setSaveError(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    await softReload();
  }

  if (!bot || !botId) return null;

  const tabDefs: {
    id: AvatarTab;
    label: string;
    icon: LucideIcon;
  }[] = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'url', label: 'Image URL', icon: Link2 },
    { id: 'emoji', label: 'Emoji', icon: Smile },
  ];

  const tabPanelHint: Record<AvatarTab, string> = {
    upload: 'Pick a file from your device or drop it here to preview how your agent avatar will look.',
    url: 'Paste a public HTTPS link to a logo or image that represents your agent (PNG, JPG, or WebP).',
    emoji: 'Use one emoji as a simple mark for your agent in the chat header.',
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col" data-profile-editor>
      <form
        id="profile-editor-form"
        className="flex min-h-0 w-full flex-1 flex-col"
        onSubmit={(e) => void onSave(e)}
        aria-label="Profile settings"
      >
        <div className="w-full min-w-0 flex-1">
          {/* Page header: intro (left); Save (right), top-aligned — preview via docked control in preview shell */}
          <header className={ws.workspaceEditorPageHeader}>
            <div className={ws.workspaceEditorTitleBlock}>
              <div className={ws.workspaceEditorHeadingStack}>
                <h1 className={ws.workspaceEditorH1}>Profile</h1>
                <p className={ws.workspaceEditorLead}>
                  How your agent is presented to visitors in chat.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col sm:pt-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!dirty || saving}
                className={cn(
                  ws.workspaceEditorButtonLabel,
                  'h-9 w-full gap-1.5 px-4 shadow-sm sm:w-auto sm:min-w-[9.5rem]',
                )}
                aria-busy={saving || undefined}
                aria-label={saving ? 'Saving profile' : `Save ${PROFILE_SECTION_NAV_LABEL}`}
              >
                {saving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2} className="animate-spin opacity-90" aria-hidden />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} strokeWidth={2} aria-hidden />
                    Save Profile
                  </>
                )}
              </Button>
            </div>
          </header>

          {saveError ? (
            <div
              className={cn(
                ws.workspaceEditorBannerText,
                'mb-4 rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[var(--color-danger-text-emphasis)]',
              )}
            >
              {saveError}
            </div>
          ) : null}

          <div className={ws.workspaceEditorCardGap}>
            {/* Identity */}
            <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="profile-identity-heading">
                  <WorkspaceSectionHeader
                    id="profile-identity-heading"
                    title="Identity"
                    description="Your agent's name, tagline, and the description visitors see before they chat."
                  />

                  <div className={ws.workspaceEditorFieldStack}>
                    <FieldRow label="Agent name" htmlFor="profile-agent-name" required className="min-w-0 gap-1.5">
                      <Input
                        id="profile-agent-name"
                        quiet
                        value={name}
                        placeholder="e.g. Support Agent"
                        onChange={(e) => {
                          setName(e.target.value);
                          markDirty();
                        }}
                        required
                      />
                    </FieldRow>

                    <FieldRow label="Tagline" htmlFor="profile-tagline" className="min-w-0 gap-1.5">
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

                    {/* Slim settings row: knowledge base */}
                    <div
                      className="flex min-h-[3.25rem] items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/40 px-3.5 py-2.5"
                      role="group"
                      aria-labelledby={`${knowledgeCheckboxId}-label`}
                    >
                      <Checkbox
                        id={knowledgeCheckboxId}
                        className="shrink-0"
                        checked={includeNameInKnowledge}
                        onChange={(e) => {
                          setIncludeNameInKnowledge(e.currentTarget.checked);
                          markDirty();
                        }}
                        aria-describedby={`${knowledgeCheckboxId}-hint`}
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          id={`${knowledgeCheckboxId}-label`}
                          htmlFor={knowledgeCheckboxId}
                          className={ws.workspaceEditorControlLabel}
                        >
                          Include in knowledge base
                        </label>
                        <p
                          id={`${knowledgeCheckboxId}-hint`}
                          className={cn(ws.workspaceEditorControlHint, 'mb-0')}
                        >
                          Adds your agent name to retrievable context.
                        </p>
                      </div>
                      <Tooltip content="When enabled, answers can reference your agent by name when helpful.">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/80 hover:text-slate-600"
                          aria-label="About including agent name in knowledge base"
                        >
                          <Info size={16} strokeWidth={1.75} aria-hidden />
                        </button>
                      </Tooltip>
                    </div>

                    <FieldRow label="Description" htmlFor="profile-description" required className="gap-1.5">
                      <Textarea
                        id="profile-description"
                        quiet
                        rows={4}
                        value={description}
                        placeholder="What does this agent help visitors with?"
                        className={cn(
                          ws.workspaceEditorControlInput,
                          'min-h-[6.5rem] resize-y border-slate-200/90 py-2.5',
                        )}
                        onChange={(e) => {
                          setDescription(e.target.value);
                          markDirty();
                        }}
                      />
                    </FieldRow>
                  </div>
                </section>
              </CardBody>
            </Card>

            {/* Agent avatar (widget identity—not a visitor profile photo) */}
            <Card className="w-full min-w-0 overflow-hidden border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.035]">
              <CardBody className="w-full min-w-0 px-5 py-5 sm:px-6 sm:py-6">
                <section className={ws.workspaceEditorCardSection} aria-labelledby="profile-avatar-heading">
                  <WorkspaceSectionHeader
                    id="profile-avatar-heading"
                    title="Agent Avatar"
                    description="A logo, image, or emoji that represents your agent in the chat header—this is your agent's identity, not an end-user profile photo."
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-5">
                    {/* Preview column */}
                    <div className="flex flex-col items-center md:items-start">
                      <div
                        className={cn(
                          'relative flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-b from-slate-50 to-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-900/[0.04]',
                          AVATAR_PREVIEW_SIZE_CLASS,
                        )}
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.75),transparent_55%)]" />
                        {showImagePreview ? (
                          <img
                            key="profile-avatar-preview"
                            src={previewSrc}
                            alt=""
                            decoding="async"
                            fetchPriority="high"
                            className="relative z-[1] h-[8.5rem] w-[8.5rem] max-h-[min(8.5rem,85%)] max-w-[min(8.5rem,85%)] rounded-2xl border border-white/90 object-cover shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.06]"
                            onLoad={() => {
                              setPreviewFailed(false);
                            }}
                            onError={() => {
                              const primary = imageUrl.trim();
                              const fb = uploadedImageFallbackUrl.trim();
                              if (
                                avatarIdentity === 'url' &&
                                fb &&
                                isUserUploadedAvatarUrl(fb) &&
                                primary &&
                                isSafeImageSrc(primary) &&
                                !imgUrlLoadFellBack
                              ) {
                                setPreviewFailed(false);
                                setImgUrlLoadFellBack(true);
                                return;
                              }
                              setPreviewFailed(true);
                            }}
                          />
                        ) : showEmojiPreview ? (
                          <div
                            className="relative z-[1] flex h-[8.5rem] w-[8.5rem] max-h-[min(8.5rem,85%)] max-w-[min(8.5rem,85%)] items-center justify-center rounded-2xl border border-slate-200/60 bg-white text-[2.25rem] leading-none shadow-sm ring-1 ring-slate-900/[0.04]"
                            aria-hidden
                          >
                            {avatarPreview.emoji}
                          </div>
                        ) : (
                          <div className="relative z-[1] flex flex-col items-center gap-2 px-4 text-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/80">
                              <Bot size={30} strokeWidth={1.35} className="text-slate-400" aria-hidden />
                            </div>
                            <p className="m-0 text-sm font-medium text-slate-500">No agent avatar yet</p>
                          </div>
                        )}
                        {hasAvatarContent ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveAvatarOpen(true)}
                            className="absolute bottom-2 right-2 z-[2] inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-500 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:bg-white hover:text-[var(--color-danger-text-emphasis)]"
                            aria-label="Remove agent avatar"
                          >
                            <Trash2 size={15} strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Right: folder tabs + panel only (aligned with preview height on md+) */}
                    <div className="flex min-h-0 min-w-0 flex-col">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                        disabled={avatarTab !== 'upload'}
                      />
                      <div
                        className={cn(
                          'grid min-h-0 w-full min-w-0 grid-cols-1 overflow-hidden',
                          'md:h-[16rem] md:max-h-[16rem] md:grid-rows-[auto_minmax(0,1fr)]',
                        )}
                      >
                      <div className="min-w-0 border-b border-slate-200">
                        <div
                          className="flex flex-wrap items-end gap-x-1 sm:gap-x-1.5"
                          role="tablist"
                          aria-label="Agent avatar source"
                          id={avatarTabsId}
                        >
                          {tabDefs.map((t) => {
                            const selected = avatarTab === t.id;
                            const TabIcon = t.icon;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                aria-controls={`${avatarTabsId}-${t.id}-panel`}
                                id={`${avatarTabsId}-${t.id}-tab`}
                                className={cn(
                                  'relative z-[1] box-border -mb-px inline-flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-t-md border border-solid px-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
                                  selected
                                    ? 'border-slate-200 border-b-white bg-white text-[var(--color-teal-700)]'
                                    : 'border-transparent text-slate-600 hover:border-slate-200/90 hover:bg-slate-50/60 hover:text-slate-900',
                                )}
                                onClick={() => {
                                  if (t.id !== avatarTab) {
                                    setAvatarTab(t.id);
                                    syncAvatarFromSavedBot();
                                  }
                                }}
                              >
                                <TabIcon
                                  size={15}
                                  strokeWidth={1.85}
                                  className={cn(
                                    'shrink-0',
                                    selected ? 'text-[var(--color-teal-700)]' : 'text-slate-500',
                                  )}
                                  aria-hidden
                                />
                                <span className="min-w-0 truncate">{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden pt-2">
                        {avatarTab === 'upload' ? (
                          <div
                            id={`${avatarTabsId}-upload-panel`}
                            role="tabpanel"
                            aria-labelledby={`${avatarTabsId}-upload-tab`}
                            className="flex h-full min-h-0 flex-col gap-2"
                          >
                            <p className={cn(ws.workspaceEditorHelperText, 'shrink-0')}>
                              {tabPanelHint.upload}
                            </p>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                fileInputRef.current?.click();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  fileInputRef.current?.click();
                                }
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                              }}
                              onDragLeave={() => setDragOver(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                handleFilePick(e.dataTransfer.files?.[0] ?? null);
                              }}
                              className={cn(
                                'group flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-5 text-center outline-none',
                                'transition-[border-color,box-shadow,background-color] duration-200 ease-out',
                                'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25 focus-visible:ring-offset-2',
                                dragOver
                                  ? 'border-[var(--color-primary)]/55 bg-gradient-to-b from-[var(--color-teal-50)]/95 to-white shadow-sm ring-1 ring-[var(--color-primary)]/20'
                                  : [
                                      'border-slate-200/95 bg-gradient-to-b from-white to-slate-50/50',
                                      'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
                                      'hover:border-[var(--color-primary)]/40 hover:bg-gradient-to-b hover:from-[var(--color-teal-50)]/35 hover:to-white hover:shadow-sm',
                                    ],
                              )}
                            >
                              <div
                                className={cn(
                                  'flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-[border-color,background-color] duration-200',
                                  dragOver
                                    ? 'border-[var(--color-primary)]/40 bg-[var(--color-teal-50)]/85'
                                    : 'border-slate-200/90 bg-white group-hover:border-[var(--color-primary)]/30 group-hover:bg-[var(--color-teal-50)]/55',
                                )}
                              >
                                <Upload
                                  size={20}
                                  strokeWidth={1.85}
                                  className={cn(
                                    'transition-colors duration-200',
                                    dragOver
                                      ? 'text-[var(--color-teal-600)]'
                                      : 'text-slate-500 group-hover:text-[var(--color-teal-600)]',
                                  )}
                                  aria-hidden
                                />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p
                                  className={cn(
                                    'm-0 max-w-full truncate text-sm leading-snug text-slate-600',
                                    imageFile ? 'text-slate-700' : '',
                                  )}
                                >
                                  {imageFile ? imageFile.name : 'Drag and drop here, or click to choose a file'}
                                </p>
                                <p className={cn(ws.workspaceEditorControlHint, 'mb-0')}>
                                  {imageFile
                                    ? 'Save profile to store this image on Assistrio.'
                                    : 'PNG, JPG, or WebP · up to 2MB'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {avatarTab === 'url' ? (
                          <div
                            id={`${avatarTabsId}-url-panel`}
                            role="tabpanel"
                            aria-labelledby={`${avatarTabsId}-url-tab`}
                            className="flex h-full min-h-0 flex-col items-stretch justify-start overflow-y-auto"
                          >
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <p className={ws.workspaceEditorHelperText}>
                                {tabPanelHint.url}
                              </p>
                              <Input
                                id="profile-image-url"
                                quiet
                                type="text"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://example.com/agent-image.png"
                                value={urlFieldDisplayValue}
                                disabled={hasImageFile}
                                aria-label="Hosted image URL for agent avatar"
                                leadingIcon={<Link2 size={16} strokeWidth={1.75} className="text-slate-500" aria-hidden />}
                                clearable
                                onClear={syncAvatarFromSavedBot}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (!v.trim()) {
                                    syncAvatarFromSavedBot();
                                    return;
                                  }
                                  setPreviewFailed(false);
                                  setImageUrl(v);
                                  setAvatarIdentity('url');
                                  markDirty();
                                }}
                              />
                              {hasImageFile ? (
                                <p className={ws.workspaceEditorHelperText}>
                                  Remove the file preview on the Upload tab to edit the URL.
                                </p>
                              ) : avatarIdentity === 'upload' ? (
                                <p className={ws.workspaceEditorHelperText}>
                                  Avatar is saved from <span className="font-medium text-slate-700">Upload</span>. Switch here
                                  to use a URL instead—any URL you enter will replace file upload as the source.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {avatarTab === 'emoji' ? (
                          <div
                            id={`${avatarTabsId}-emoji-panel`}
                            role="tabpanel"
                            aria-labelledby={`${avatarTabsId}-emoji-tab`}
                            className="flex h-full min-h-0 flex-col items-stretch justify-start overflow-y-auto"
                          >
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <p className={ws.workspaceEditorHelperText}>
                                {tabPanelHint.emoji}
                              </p>
                              {avatarIdentity === 'upload' ? (
                                <p className={cn(ws.workspaceEditorHelperText, 'mb-0')}>
                                  Avatar is saved from <span className="font-medium text-slate-700">Upload</span>. Pick or type
                                  an emoji below to switch to an emoji avatar (this will replace the uploaded image after you
                                  save).
                                </p>
                              ) : null}
                              <div ref={emojiPickerWrapRef} className="relative w-full">
                                <div className="flex w-full gap-0 overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-[var(--color-teal-600)]/35 focus-within:ring-2 focus-within:ring-[var(--color-primary)]/15">
                                  <button
                                    ref={emojiPickerTriggerRef}
                                    type="button"
                                    className={cn(
                                      'inline-flex h-10 w-10 shrink-0 items-center justify-center border-none bg-transparent text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600',
                                      emojiPickerOpen && 'bg-slate-50 text-[var(--color-teal-700)]',
                                    )}
                                    aria-expanded={emojiPickerOpen}
                                    aria-haspopup="dialog"
                                    aria-controls="profile-emoji-picker"
                                    aria-label="Open emoji picker"
                                    onClick={() => setEmojiPickerOpen((o) => !o)}
                                  >
                                    <Smile size={16} strokeWidth={1.75} aria-hidden />
                                  </button>
                                  <input
                                    id="profile-avatar-emoji"
                                    className={cn(
                                      ws.workspaceEditorControlInput,
                                      'min-h-10 min-w-0 flex-1 border-none bg-transparent py-2 pr-3 text-[0.9375rem] text-slate-800 shadow-none outline-none ring-0 focus:ring-0',
                                    )}
                                    value={emojiFieldDisplayValue}
                                    placeholder="Type or pick an emoji"
                                    maxLength={24}
                                    aria-label="Emoji for agent avatar"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const v = clampAvatarEmojiInput(e.target.value);
                                      if (!v.trim()) {
                                        syncAvatarFromSavedBot();
                                        return;
                                      }
                                      setAvatarEmoji(v);
                                      setAvatarIdentity('emoji');
                                      markDirty();
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      </div>
                    </div>
                  </div>
                </section>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>

      <Modal
        open={confirmRemoveAvatarOpen}
        onClose={() => setConfirmRemoveAvatarOpen(false)}
        title="Remove image from agent avatar?"
        tone="danger"
        description="This permanently removes the agent avatar once you click Save profile. This action cannot be undone."
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmRemoveAvatarOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleRemoveAvatar}>
              Remove image
            </Button>
          </>
        }
      >
        <p className={cn(ws.workspaceEditorHelperText, 'm-0')}>
          Visitors will see the default placeholder until you add a new image or emoji and save.
        </p>
      </Modal>

      {emojiPickerOpen && emojiPickerPos
        ? createPortal(
            <div
              ref={emojiPickerPopoverRef}
              id="profile-emoji-picker"
              role="dialog"
              aria-label="Suggested emojis"
              className="w-[min(17.5rem,calc(100vw-1rem))] rounded-xl border border-slate-200/95 bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]"
              style={{
                position: 'fixed',
                top: emojiPickerPos.top,
                left: emojiPickerPos.left,
                zIndex: 10050,
              }}
            >
              <div className="flex max-h-[min(13rem,calc(100vh-6rem))] flex-wrap gap-1 overflow-y-auto" role="list">
                {COMMON_AVATAR_EMOJIS.map((ch, i) => (
                  <button
                    key={`emoji-preset-${i}`}
                    type="button"
                    role="listitem"
                    className={cn(
                      'inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200/90 bg-slate-50/80 text-sm leading-none',
                      'transition hover:border-[var(--color-teal-600)]/40 hover:bg-[var(--color-teal-50)]/90',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
                    )}
                    onClick={() => {
                      setAvatarEmoji(ch);
                      setAvatarIdentity('emoji');
                      setAvatarTab('emoji');
                      markDirty();
                      setEmojiPickerOpen(false);
                    }}
                    aria-label={`Use ${ch} as avatar`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
