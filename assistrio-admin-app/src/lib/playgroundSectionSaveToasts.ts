import { appToast } from '@/lib/app-toast';

export type PlaygroundSectionId =
  | 'profile'
  | 'behavior'
  | 'captureLeads'
  | 'chatExperience'
  | 'widgetAppearance'
  | 'aiIntegrations'
  | 'translation'
  | 'deploy';

const SECTION_SUCCESS: Record<
  PlaygroundSectionId,
  { title: string; description: string }
> = {
  profile: {
    title: 'Profile saved',
    description: 'Your bot name, description, and avatar settings are updated.',
  },
  behavior: {
    title: 'Behavior saved',
    description: 'Personality, welcome message, and example questions are updated.',
  },
  captureLeads: {
    title: 'Lead capture saved',
    description: 'Form fields, timing, and capture rules are updated for the widget.',
  },
  chatExperience: {
    title: 'Chat experience saved',
    description: 'Input tools, status display, and multi-chat settings are updated.',
  },
  widgetAppearance: {
    title: 'Widget appearance saved',
    description: 'Branding, launcher, and layout changes apply to the chat widget.',
  },
  aiIntegrations: {
    title: 'AI & advanced settings saved',
    description: 'Model tuning and file, mic, and voice options are updated.',
  },
  translation: {
    title: 'Translation settings saved',
    description: 'How the assistant handles customer languages is updated.',
  },
  deploy: {
    title: 'Deploy settings saved',
    description: 'Publish state, visibility, and allowed websites are updated.',
  },
};

export function toastPlaygroundSectionSaved(section: PlaygroundSectionId): void {
  const c = SECTION_SUCCESS[section];
  appToast.success(c.title, { description: c.description });
}

function sectionLabel(section: PlaygroundSectionId): string {
  return SECTION_SUCCESS[section].title.replace(/ saved$/, '');
}

export function toastPlaygroundSectionSaveFailed(section: PlaygroundSectionId, apiDetail?: string): void {
  const detail = apiDetail?.trim();
  const short = sectionLabel(section);
  appToast.error(`${short} could not be saved`, {
    description:
      detail ||
      'Check your connection and try again. If the problem continues, contact support.',
  });
}

/** Client-side validation before calling the API (missing fields, incompatible options). */
export function toastPlaygroundValidationWarning(title: string, description: string): void {
  appToast.warning(title, { description });
}

export function toastPlaygroundDeployOriginsSaveFailed(apiDetail?: string): void {
  const detail = apiDetail?.trim();
  appToast.error('Allowed websites could not be updated', {
    description:
      detail ||
      'Check your connection and try again. If the problem continues, contact support.',
  });
}

export function toastPlaygroundAccessKeyRotated(): void {
  appToast.success('Access key rotated', {
    description: 'Update any embed code or integrations that still use the previous key.',
  });
}

export function toastPlaygroundAccessKeyRotateFailed(apiDetail?: string): void {
  const detail = apiDetail?.trim();
  appToast.error('Access key could not be rotated', {
    description: detail || 'Please try again in a moment.',
  });
}

export function toastPlaygroundSecretKeyRotated(): void {
  appToast.success('Secret key rotated', {
    description: 'Approve only trusted installs; update private embed configurations if needed.',
  });
}

export function toastPlaygroundSecretKeyRotateFailed(apiDetail?: string): void {
  const detail = apiDetail?.trim();
  appToast.error('Secret key could not be rotated', {
    description: detail || 'Please try again in a moment.',
  });
}
