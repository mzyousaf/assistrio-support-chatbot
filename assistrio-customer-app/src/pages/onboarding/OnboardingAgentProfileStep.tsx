import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';
import { useOnboardingStepUi } from '../../onboarding/OnboardingStepUiContext';
import { useRegisterOnboardingStepActions } from '../../onboarding/OnboardingStepActionsContext';
import {
  hydrateAgentProfileFromDraft,
  isAgentProfileStepDirty,
} from '../../onboarding/onboardingStepDirty';
import { buildOnboardingProfilePatchBody } from '../../onboarding/onboardingProfilePatch';
import { useRegisterOnboardingStepGuard } from '../../onboarding/useRegisterOnboardingStepGuard';

import { styles } from './onboardingStep';
import { FieldRow, Input } from '@/components/ui';
import { OnboardingStepPanel } from '@/components/onboarding/OnboardingStepPanel';
import { AgentCategoryField } from '@/components/agent/AgentCategoryField';
import {
  AgentAvatarField,
  agentAvatarStateFromDraft,
  resolveAgentAvatarPayload,
  type AgentAvatarState,
} from '@/components/agent/AgentAvatarField';
import { AgentBrandColorField } from '@/components/agent/AgentBrandColorField';
import {
  categoriesToPayload,
  emptyAgentCategoryValue,
  hasAgentCategorySelection,
  type AgentCategoryValue,
} from '@/components/agent/categoryUtils';
import { BOT_FIELD_MAX, clampStr } from '@/lib/botFieldLimits';
import { DEFAULT_PRIMARY_HEX, normalizePrimaryColor } from '@/lib/primaryColorNormalize';
import {
  toastOnboardingAvatarUploaded,
  toastOnboardingAvatarUploadFailed,
  toastOnboardingStepSaved,
  toastOnboardingStepSaveFailed,
} from '@/lib/onboardingActionToasts';

const STEP = 'agent-profile';
const PROFILE_AUTOSAVE_MS = 800;

function CharCounter({ length, max }: { length: number; max: number }) {
  return (
    <span
      className="ml-auto shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]"
      aria-live="polite"
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function FormGroup({
  title,
  hint,
  sectionHeading,
  children,
}: {
  title: string;
  hint?: string;
  /** Muted non-interactive section label (e.g. Agent Personality). */
  sectionHeading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.formGroup}>
      <div className={styles.formGroupHeader}>
        <h3
          className={sectionHeading ? styles.formSectionHeading : styles.formGroupTitle}
        >
          {title}
        </h3>
        {hint ? <p className={styles.formGroupHint}>{hint}</p> : null}
      </div>
      <div className={styles.formGroupBody}>{children}</div>
    </section>
  );
}

export function OnboardingAgentProfileStep() {
  const { onboarding, patchProfile, uploadAvatar, markStepDone, goToNextAfter } = useOnboardingFlow();
  const { markStepAttemptFailed, clearStepAttempt, setSavingStepId } = useOnboardingStepUi();
  const profile = onboarding?.draft.profile;
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [brandColor, setBrandColor] = useState(DEFAULT_PRIMARY_HEX);
  const [category, setCategory] = useState<AgentCategoryValue>(() => emptyAgentCategoryValue());
  const [avatar, setAvatar] = useState<AgentAvatarState>(() => agentAvatarStateFromDraft(null));
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; category?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const hydratedWorkspaceRef = useRef<string | null>(null);
  const formBusy = saving || avatarUploading;

  useEffect(() => {
    if (!profile || !onboarding?.workspaceId) return;
    if (hydratedWorkspaceRef.current === onboarding.workspaceId) return;
    hydratedWorkspaceRef.current = onboarding.workspaceId;
    const hydrated = hydrateAgentProfileFromDraft(profile);
    setName(clampStr(hydrated.name, BOT_FIELD_MAX.name));
    setTagline(clampStr(hydrated.tagline, BOT_FIELD_MAX.shortDescription));
    setBrandColor(normalizePrimaryColor(hydrated.brandColor || DEFAULT_PRIMARY_HEX));
    setCategory(hydrated.category);
    setAvatar(hydrated.avatar);
    setFieldErrors({});
    setError(null);
  }, [onboarding?.workspaceId, profile]);

  const profilePatchArgs = useCallback(
    () => ({
      name,
      tagline,
      brandColor,
      category,
      avatar,
      draftProfile: onboarding?.draft.profile,
    }),
    [avatar, brandColor, category, name, onboarding?.draft.profile, tagline],
  );

  useEffect(() => {
    if (!onboarding?.workspaceId || hydratedWorkspaceRef.current !== onboarding.workspaceId) return;
    if (formBusy) return;
    if (
      !isAgentProfileStepDirty({
        name,
        tagline,
        brandColor,
        category,
        avatar,
        profile,
      })
    ) {
      return;
    }

    const body = buildOnboardingProfilePatchBody(profilePatchArgs());
    if (!body) return;

    const timer = window.setTimeout(() => {
      void patchProfile(body);
    }, PROFILE_AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [
    avatar,
    brandColor,
    category,
    formBusy,
    name,
    onboarding?.workspaceId,
    patchProfile,
    profile,
    profilePatchArgs,
    tagline,
  ]);

  const hydrateFromDraft = useCallback(() => {
    if (!profile) return;
    const hydrated = hydrateAgentProfileFromDraft(profile);
    setName(clampStr(hydrated.name, BOT_FIELD_MAX.name));
    setTagline(clampStr(hydrated.tagline, BOT_FIELD_MAX.shortDescription));
    setBrandColor(normalizePrimaryColor(hydrated.brandColor || DEFAULT_PRIMARY_HEX));
    setCategory(hydrated.category);
    setAvatar(hydrated.avatar);
    setFieldErrors({});
    setError(null);
  }, [profile]);

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      setAvatarUploading(true);
      setError(null);
      try {
        const body = buildOnboardingProfilePatchBody(profilePatchArgs());
        if (!body) {
          return { ok: false as const, error: 'Enter profile details before uploading an avatar.' };
        }
        const preSave = await patchProfile(body);
        if (!preSave.ok) {
          setError(preSave.error);
          toastOnboardingStepSaveFailed('agent-profile', preSave.error);
          return { ok: false as const, error: preSave.error };
        }

        const uploaded = await uploadAvatar(file);
        if (!uploaded.ok) {
          setError(uploaded.error);
          toastOnboardingAvatarUploadFailed(uploaded.error);
          return uploaded;
        }

        setAvatar(agentAvatarStateFromDraft(uploaded.profile));
        toastOnboardingAvatarUploaded();
        return { ok: true as const };
      } finally {
        setAvatarUploading(false);
      }
    },
    [patchProfile, profilePatchArgs, uploadAvatar],
  );

  const persistProfile = useCallback(async (opts?: { toastOnSuccess?: boolean }): Promise<boolean> => {
    setError(null);
    const n = name.trim();
    if (!n) {
      setFieldErrors({ name: 'Agent name is required.' });
      return false;
    }
    if (!hasAgentCategorySelection(category)) {
      setFieldErrors({ category: 'Select at least one category.' });
      return false;
    }
    setFieldErrors({});

    if (avatar.pendingFile) {
      const uploaded = await handleAvatarUpload(avatar.pendingFile);
      if (!uploaded.ok) {
        setError(uploaded.error);
        return false;
      }
    }

    const avatarFields = resolveAgentAvatarPayload(avatar);
    const tag = tagline.trim();
    const categories = categoriesToPayload(category);
    const draftProfile = onboarding?.draft.profile;

    const res = await patchProfile({
      name: n,
      shortDescription: tag || undefined,
      brandColor: normalizePrimaryColor(brandColor),
      categories,
      avatarSource: avatarFields.avatarSource,
      imageUrl: avatarFields.imageUrl || undefined,
      avatarEmoji: avatarFields.avatarEmoji || undefined,
      ...(avatarFields.avatarSource === 'upload' && draftProfile?.avatarStorageKey
        ? { avatarStorageKey: draftProfile.avatarStorageKey }
        : avatarFields.avatarSource === 'none'
          ? { avatarStorageKey: '' }
          : {}),
    });
    if (!res.ok) {
      setError(res.error);
      toastOnboardingStepSaveFailed('agent-profile', res.error);
      return false;
    }
    if (opts?.toastOnSuccess !== false) {
      toastOnboardingStepSaved('agent-profile');
    }
    return true;
  }, [
    avatar,
    brandColor,
    category,
    handleAvatarUpload,
    name,
    onboarding?.draft.profile,
    patchProfile,
    tagline,
  ]);

  useRegisterOnboardingStepGuard({
    isDirty: () =>
      isAgentProfileStepDirty({ name, tagline, brandColor, category, avatar, profile }),
    discard: hydrateFromDraft,
    save: persistProfile,
  });

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    clearStepAttempt(STEP);
    setSaving(true);
    setSavingStepId(STEP);
    try {
      const saved = await persistProfile({ toastOnSuccess: false });
      if (!saved) {
        markStepAttemptFailed(STEP);
        return;
      }
      await markStepDone(STEP);
      toastOnboardingStepSaved('agent-profile');
      goToNextAfter(STEP);
    } finally {
      setSaving(false);
      setSavingStepId(null);
    }
  }

  useRegisterOnboardingStepActions({
    primaryLabel: saving ? 'Saving…' : 'Continue',
    primaryLoading: saving,
    primaryDisabled: formBusy,
  });

  return (
    <OnboardingStepPanel
      stepId={STEP}
      headerClassName="agent-profile-header"
      eyebrow="Agent profile"
      title="Your AI Agent Profile"
      description="Set how your agent appears to visitors — name, avatar, look, and category."
      formProps={{ onSubmit: (e) => void onContinue(e) }}
    >
      {error ? (
        <div className={styles.errBanner} role="alert">
          {error}
        </div>
      ) : null}

      <div className={styles.formFields}>
        <FormGroup
          title="Identity"
          hint="Give your agent a name and avatar so it feels recognizable from the start."
        >
          <AgentAvatarField
            value={avatar}
            onChange={setAvatar}
            disabled={formBusy}
            onUploadFile={handleAvatarUpload}
            agentName={name}
            layout="compact"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start sm:gap-x-4">
            <FieldRow
              label="Agent name"
              required
              error={fieldErrors.name}
              labelTooltip="The name visitors see when they chat with your agent."
              labelAddon={<CharCounter length={name.length} max={BOT_FIELD_MAX.name} />}
            >
              <Input
                id="onb-profile-name"
                quiet
                value={name}
                invalid={Boolean(fieldErrors.name)}
                maxLength={BOT_FIELD_MAX.name}
                disabled={formBusy}
                onChange={(e) => {
                  setName(e.target.value.slice(0, BOT_FIELD_MAX.name));
                  if (fieldErrors.name) {
                    setFieldErrors({});
                    clearStepAttempt(STEP);
                  }
                }}
                autoComplete="off"
                placeholder="e.g. Assistrio Support"
              />
            </FieldRow>
            <FieldRow
              label="Tagline"
              labelTooltip="A short one-line intro shown in your workspace or widget."
              labelAddon={<CharCounter length={tagline.length} max={BOT_FIELD_MAX.shortDescription} />}
            >
              <Input
                id="onb-profile-tagline"
                quiet
                value={tagline}
                maxLength={BOT_FIELD_MAX.shortDescription}
                disabled={formBusy}
                onChange={(e) => setTagline(e.target.value.slice(0, BOT_FIELD_MAX.shortDescription))}
                placeholder="e.g. Your 24/7 product specialist"
              />
            </FieldRow>
          </div>
        </FormGroup>

        <div className={styles.formDivider} aria-hidden />

        <FormGroup title="Appearance" hint="Set the accent color for your widget and workspace.">
          <AgentBrandColorField
            value={brandColor}
            onChange={setBrandColor}
            disabled={formBusy}
            idPrefix="onb-profile"
          />
        </FormGroup>

        <div className={styles.formDivider} aria-hidden />

        <FormGroup
          title="Agent Personality"
          sectionHeading
          hint="Pick at least one category (up to three), or switch to custom when your use case isn't listed."
        >
          <AgentCategoryField
            value={category}
            onChange={(next) => {
              setCategory(next);
              if (fieldErrors.category) {
                setFieldErrors((prev) => {
                  const { category: _removed, ...rest } = prev;
                  return rest;
                });
                clearStepAttempt(STEP);
              }
            }}
            disabled={formBusy}
            idPrefix="onb-profile-cat"
            heading="Category"
            error={fieldErrors.category}
            showHint={false}
          />
        </FormGroup>
      </div>
    </OnboardingStepPanel>
  );
}
