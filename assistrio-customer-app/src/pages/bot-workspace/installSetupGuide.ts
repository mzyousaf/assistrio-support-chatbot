import type { EmbedInstallMode } from './PublishWorkspaceContext';

/** Short numbered list. Use `**bold**` and `` `mono` `` in lines. */
export type InstallSetupGuide = {
  title: string;
  description: string;
  lines: string[];
};

/** Copy for the Deploy “How to set up” help modal (chat widget vs iframe only). */
export function getInstallSetupGuide(installMode: EmbedInstallMode): InstallSetupGuide {
  if (installMode === 'iframe') {
    return {
      title: 'How to set up iframe',
      description: 'Follow these quick steps to install the iframe.',
      lines: [
        'Add at least one allowed website in the list above.',
        'Select **Iframe** as your install method and choose the correct visibility.',
        'Click **Copy Snippet** to copy the iframe install code.',
        'Paste that iframe code where you want the full chat panel to appear, such as a support page, contact page, help center, or dashboard.',
        'Optional but recommended for **Chats → Top Pages** analytics: add a `parentPageUrl` query parameter to the iframe `src` with the URL of the page hosting the chat (for example `&parentPageUrl=` plus `encodeURIComponent(window.location.href)` when you render the iframe with JavaScript).',
        'Adjust the iframe height or container width if needed.',
        'Publish your website changes and refresh to confirm the chat panel appears.',
      ],
    };
  }

  return {
    title: 'How to set up widget',
    description: 'Follow these quick steps to install your widget.',
    lines: [
      'Add at least one allowed website in the list above.',
      'Select your install method and visibility.',
      'Click **Copy Snippet** to copy the install code.',
      'Paste that code in the location recommended for your platform (for many sites this is before `</body>`).',
      'Publish your website changes and refresh to confirm the widget appears.',
    ],
  };
}
