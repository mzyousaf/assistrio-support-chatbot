import type { EmbedVisibility } from './PublishWorkspaceContext';

export const VISIBILITY_CHOICE_SUBTITLE =
  'Both are secure if keys stay private. Embed only on sites you control—never expose keys or snippets publicly.';

export const VISIBILITY_CHOICE_OPTIONS: { value: EmbedVisibility; label: string; hint: string }[] = [
  {
    value: 'public',
    label: 'Public',
    hint: 'Uses the access key only. Safe on your allowed sites as long as you keep install code and keys out of public view.',
  },
  {
    value: 'private',
    label: 'Private',
    hint: 'Requires access and secret keys for extra verification. Still secure only if both keys stay private — never expose the snippet publicly.',
  },
];
