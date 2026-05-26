import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Icon } from '@iconify/react';
import {
  Camera,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  User,
} from 'lucide-react';
import { patchCustomerMeProfile, postCustomerMeAvatar } from '@/api/customerApi';
import { useCustomerAuth } from '@/auth/CustomerAuthContext';
import { Button, Input, Label, Modal } from '@/components/ui';
import {
  modalFormFieldLabelClass,
  modalFormInputSize,
} from '@/components/ui/modalFormFieldStyles';
import { CUSTOMER_AVATAR_ACCEPT, validateCustomerAvatarFile } from '@/lib/customerAvatarUpload';
import { customerInitials } from '@/lib/customerDisplay';
import { appToast } from '@/lib/app-toast';
import {
  buildCustomerProfilePatchPayload,
  customerProfileFormFromSession,
  validateCustomerProfileForm,
  type CustomerProfileFieldErrors,
  type CustomerProfileFormState,
} from '@/lib/customerProfileForm';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
};

function LinkedInBrandIcon() {
  return (
    <span className="inline-flex shrink-0 text-[#0A66C2]" aria-hidden>
      <Icon icon="simple-icons:linkedin" width={16} height={16} />
    </span>
  );
}

function CalendlyBrandIcon() {
  return (
    <span className="inline-flex shrink-0 text-[#006BFF]" aria-hidden>
      <Icon icon="simple-icons:calendly" width={16} height={16} />
    </span>
  );
}

function ProfileLinkField(props: {
  id: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  placeholder: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Input
        id={props.id}
        type="url"
        inputSize={modalFormInputSize}
        quiet
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        leadingIcon={props.icon}
        invalid={Boolean(props.error)}
        disabled={props.disabled}
        autoComplete="off"
        aria-label={props.ariaLabel}
      />
      {props.error ? (
        <p className="m-0 text-xs leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
          {props.error}
        </p>
      ) : null}
    </div>
  );
}

export function AccountSettingsModal({ open, onClose }: Props) {
  const { customer, applyCustomerSession } = useCustomerAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const nameId = useId();
  const emailId = useId();
  const websiteId = useId();
  const linkedinId = useId();
  const calendlyId = useId();
  const otherUrlId = useId();

  const [baseline, setBaseline] = useState<CustomerProfileFormState | null>(null);
  const [form, setForm] = useState<CustomerProfileFormState>({
    name: '',
    linkedinUrl: '',
    calendlyUrl: '',
    websiteUrl: '',
    otherUrl: '',
  });
  const [fieldErrors, setFieldErrors] = useState<CustomerProfileFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    const next = customerProfileFormFromSession(customer);
    setBaseline(next);
    setForm(next);
    setFieldErrors({});
    setFormError(null);
    setSaving(false);
    setUploading(false);
    setAvatarImgFailed(false);
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setAvatarPreviewUrl(null);
  }, [open, customer]);

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const initials = useMemo(() => (customer ? customerInitials(customer) : '?'), [customer]);
  const sessionPicture = customer?.picture?.trim();
  const displayPicture = avatarPreviewUrl ?? sessionPicture;
  const email = customer?.email?.trim() || '—';
  const busy = saving || uploading;

  const dirty = useMemo(() => {
    if (!baseline) return false;
    const patch = buildCustomerProfilePatchPayload(form, baseline);
    return Boolean(patch.name || patch.profileLinks);
  }, [form, baseline]);

  const validationErrors = useMemo(() => validateCustomerProfileForm(form), [form]);
  const inlineErrors = useMemo(
    () => ({ ...validationErrors, ...fieldErrors }),
    [validationErrors, fieldErrors],
  );
  const hasValidationErrors = Object.keys(validationErrors).length > 0;
  const canSave = dirty && !hasValidationErrors && !busy;

  function updateForm<K extends keyof CustomerProfileFormState>(key: K, value: CustomerProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function openAvatarPicker() {
    if (busy) return;
    fileInputRef.current?.click();
  }

  async function handleAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validation = validateCustomerAvatarFile(file);
    if (!validation.ok) {
      appToast.error(validation.error);
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    previewObjectUrlRef.current = previewUrl;
    setAvatarPreviewUrl(previewUrl);
    setAvatarImgFailed(false);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    const result = await postCustomerMeAvatar(formData);
    setUploading(false);

    if (!result.ok) {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      setAvatarPreviewUrl(null);
      appToast.error(result.error?.trim() || 'Could not upload profile photo.');
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setAvatarPreviewUrl(null);
    applyCustomerSession(result.data.customer);
    appToast.success('Profile photo updated.');
  }

  async function handleSave() {
    if (!customer || !baseline || busy) return;
    const errors = validateCustomerProfileForm(form);
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    const patch = buildCustomerProfilePatchPayload(form, baseline);
    if (!patch.name && !patch.profileLinks) {
      onClose();
      return;
    }

    setSaving(true);
    const result = await patchCustomerMeProfile(patch);
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error?.trim() || 'Could not save account settings.');
      return;
    }

    applyCustomerSession(result.data.customer);
    appToast.success('Account settings saved.');
    onClose();
  }

  function handleClose() {
    if (busy) return;
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        <span className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/70 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            aria-hidden
          >
            <User className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight text-slate-900">Account settings</span>
        </span>
      }
      description={
        <p className="m-0 mt-0.5 text-xs leading-snug text-slate-500">
          Manage your profile details and public contact links.
        </p>
      }
      className="w-[calc(100vw-24px)] max-w-[450px] sm:w-full min-h-[32rem] max-h-[min(92vh,44rem)]"
      headerClassName="!border-slate-200/70 !bg-white px-5 py-4"
      bodyClassName="px-5 py-4"
      footerClassName="!border-slate-200/70 !bg-white px-5 py-3 gap-2"
      overlayClassName="p-3 sm:p-6"
      allowDismiss={!busy}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!canSave} onClick={() => void handleSave()}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 inline-block animate-spin" size={14} aria-hidden />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError ? (
          <div
            className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] px-4 py-3 text-sm text-[var(--color-danger-text-emphasis)]"
            role="alert"
          >
            {formError}
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            className={cn(
              'group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2',
              busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
            )}
            aria-label="Change profile photo"
            disabled={busy}
            onClick={openAvatarPicker}
          >
            <div
              className={cn(
                'relative flex size-20 items-center justify-center overflow-hidden rounded-full border border-slate-200/90 bg-teal-50 text-xl font-semibold text-teal-700 shadow-[var(--shadow-xs)]',
              )}
              aria-hidden={Boolean(displayPicture && !avatarImgFailed)}
            >
              {displayPicture && !avatarImgFailed ? (
                <img
                  src={displayPicture}
                  alt=""
                  className="size-full object-cover"
                  onError={() => setAvatarImgFailed(true)}
                />
              ) : (
                initials
              )}
              {uploading ? (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Loader2 className="animate-spin text-teal-700" size={22} aria-hidden />
                </span>
              ) : null}
            </div>
            <span
              className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-[var(--shadow-xs)] group-hover:bg-teal-50 group-hover:text-teal-700"
              aria-hidden
            >
              <Camera size={14} strokeWidth={2} />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={CUSTOMER_AVATAR_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void handleAvatarSelected(event)}
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor={nameId} className={modalFormFieldLabelClass}>
              Name
            </Label>
            <Input
              id={nameId}
              inputSize={modalFormInputSize}
              quiet
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              leadingIcon={<User className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
              invalid={Boolean(inlineErrors.name)}
              disabled={busy}
              autoComplete="name"
            />
            {inlineErrors.name ? (
              <p className="m-0 text-xs leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
                {inlineErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor={emailId} className={modalFormFieldLabelClass}>
              Email
            </Label>
            <Input
              id={emailId}
              inputSize={modalFormInputSize}
              quiet
              value={email}
              readOnly
              disabled
              leadingIcon={<Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
            />
          </div>

          <div>
            <Label htmlFor={websiteId} className={modalFormFieldLabelClass}>
              Website
            </Label>
            <Input
              id={websiteId}
              type="url"
              inputSize={modalFormInputSize}
              quiet
              value={form.websiteUrl}
              onChange={(e) => updateForm('websiteUrl', e.target.value)}
              placeholder="https://your-site.com"
              leadingIcon={<Globe className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
              invalid={Boolean(inlineErrors.websiteUrl)}
              disabled={busy}
              autoComplete="url"
            />
            {inlineErrors.websiteUrl ? (
              <p className="m-0 text-xs leading-snug text-[var(--color-danger-text-emphasis)]" role="alert">
                {inlineErrors.websiteUrl}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-slate-200/70 pt-3 pb-3">
          <h3 className="m-0 mb-3 text-sm font-semibold text-slate-900">Links</h3>
          <div className="space-y-2">
            <ProfileLinkField
              id={linkedinId}
              ariaLabel="LinkedIn URL"
              value={form.linkedinUrl}
              onChange={(linkedinUrl) => updateForm('linkedinUrl', linkedinUrl)}
              icon={<LinkedInBrandIcon />}
              placeholder="https://linkedin.com/in/your-name"
              error={inlineErrors.linkedinUrl}
              disabled={busy}
            />
            <ProfileLinkField
              id={calendlyId}
              ariaLabel="Calendly URL"
              value={form.calendlyUrl}
              onChange={(calendlyUrl) => updateForm('calendlyUrl', calendlyUrl)}
              icon={<CalendlyBrandIcon />}
              placeholder="https://calendly.com/your-name"
              error={inlineErrors.calendlyUrl}
              disabled={busy}
            />
            <ProfileLinkField
              id={otherUrlId}
              ariaLabel="Other link URL"
              value={form.otherUrl}
              onChange={(otherUrl) => updateForm('otherUrl', otherUrl)}
              icon={<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />}
              placeholder="https://example.com/your-link"
              error={inlineErrors.otherUrl}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
