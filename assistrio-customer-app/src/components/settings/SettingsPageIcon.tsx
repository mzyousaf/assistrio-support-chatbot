import { Building2, CreditCard, Gem, Users } from 'lucide-react';
import type { SettingsNavRoute } from '@/lib/settingsNavigation';

const ICONS = {
  '/settings/workspace': Building2,
  '/settings/members': Users,
  '/settings/plans': Gem,
  '/settings/billing': CreditCard,
} as const satisfies Record<SettingsNavRoute, typeof Building2>;

type Props = {
  route: SettingsNavRoute;
};

export function SettingsPageIcon({ route }: Props) {
  const Icon = ICONS[route];
  return <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />;
}
