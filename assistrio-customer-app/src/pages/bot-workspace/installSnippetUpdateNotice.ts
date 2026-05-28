import type { EmbedInstallMode, EmbedVisibility } from './PublishWorkspaceContext';

export type InstallSnippetUpdateReason = 'visibility' | 'accessKey' | 'secretKey';

export type InstallSnippetUpdateNotice = {
  reason: InstallSnippetUpdateReason;
  visibility: EmbedVisibility;
};

function installMethodLabel(installMode: EmbedInstallMode): string {
  return installMode === 'iframe' ? 'iframe embed' : 'chat widget script';
}

export function getInstallSnippetCopiedToastMessage(installMode: EmbedInstallMode): string {
  return installMode === 'iframe' ? 'Iframe snippet copied.' : 'Chat widget snippet copied.';
}

export function getInstallSnippetCopyButtonLabel(installMode: EmbedInstallMode): string {
  return installMode === 'iframe' ? 'Copy iframe code' : 'Copy chat widget code';
}

export function getInstallSnippetUpdateNotice(
  notice: InstallSnippetUpdateNotice,
  installMode: EmbedInstallMode,
): { title: string; description: string; bullets: string[] } {
  const method = installMethodLabel(installMode);

  if (notice.reason === 'visibility') {
    return {
      title: 'Update your install code',
      description:
        'Visibility is now Private. Your live embeds need the updated install code with the current keys.',
      bullets: [
        `Copy the updated ${method} from the Install code section on this page.`,
        'Private visibility requires both the access key and secret key in the snippet.',
        'Replace the old embed on every allowed website, then publish and refresh each site.',
      ],
    };
  }

  if (notice.reason === 'accessKey') {
    return {
      title: 'Update your install code',
      description: 'Your access key changed. Embeds using the old key will stop working until you update them.',
      bullets: [
        `Copy the updated ${method} from the Install code section on this page.`,
        'The access key in the snippet must match the new key shown here.',
        ...(notice.visibility === 'private'
          ? ['Keep the secret key in the snippet if visibility is Private.']
          : []),
        'Replace the old embed on every allowed website, then publish and refresh each site.',
      ],
    };
  }

  return {
    title: 'Update your install code',
    description: 'Your secret key changed. Private embeds must use the new key in the install code.',
    bullets: [
      `Copy the updated ${method} from the Install code section on this page.`,
      'Update the secret key in the snippet to match the new value shown here.',
      'Replace the old embed on every allowed website, then publish and refresh each site.',
    ],
  };
}
