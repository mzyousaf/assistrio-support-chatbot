export const ASSISTRIO_PLATFORM_WORKSPACE_NAME = 'Assistrio Platform Workspace';

export const PLATFORM_BOT_TYPES = [
  'landing_demo',
  'showcase',
  'support',
  'internal',
] as const;

export type PlatformBotType = (typeof PLATFORM_BOT_TYPES)[number];

export function isPlatformBotType(value: unknown): value is PlatformBotType {
  return typeof value === 'string' && (PLATFORM_BOT_TYPES as readonly string[]).includes(value);
}

export function platformBotTypeLabel(type: PlatformBotType | string | undefined): string {
  switch (type) {
    case 'landing_demo':
      return 'Landing demo';
    case 'showcase':
      return 'Showcase';
    case 'support':
      return 'Support';
    case 'internal':
      return 'Internal';
    default:
      return type ? String(type) : '—';
  }
}
