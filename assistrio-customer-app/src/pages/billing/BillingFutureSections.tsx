import { CreditCard, FileText, Package } from 'lucide-react';
import { SettingsInfoCard } from '@/components/settings/SettingsInfoCard';
import { Button } from '@/components/ui';

const FUTURE_SECTIONS = [
  {
    id: 'payment-method',
    icon: CreditCard,
    title: 'Payment method',
    description: 'Add and manage cards when checkout is enabled.',
  },
  {
    id: 'invoices',
    icon: FileText,
    title: 'Invoices',
    description: 'Download billing history and receipts here.',
  },
  {
    id: 'addons-management',
    icon: Package,
    title: 'Add-ons',
    description: 'Purchase and manage workspace add-ons.',
  },
] as const;

export function BillingFutureSections() {
  return (
    <section aria-labelledby="billing-future-heading" className="space-y-3">
      <div>
        <h2 id="billing-future-heading" className="m-0 text-base font-semibold text-slate-900">
          Billing management
        </h2>
        <p className="m-0 mt-1 text-sm text-slate-500">
          These sections will activate when payments are enabled.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {FUTURE_SECTIONS.map((section) => (
          <SettingsInfoCard
            key={section.id}
            id={`billing-${section.id}`}
            icon={section.icon}
            title={section.title}
            description={section.description}
            variant="muted"
            action={
              <Button type="button" variant="secondary" size="sm" disabled>
                Coming soon
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}
