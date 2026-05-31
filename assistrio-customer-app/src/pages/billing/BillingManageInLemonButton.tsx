import { Button } from '@/components/ui';
import { useBillingPortal } from '@/hooks/useBillingPortal';

type Props = {
  workspaceId: string;
  disabled?: boolean;
  className?: string;
};

export function BillingManageInLemonButton({ workspaceId, disabled, className }: Props) {
  const portal = useBillingPortal(workspaceId);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || portal.loading}
      className={className}
      onClick={() => void portal.openPortal()}
    >
      {portal.loading ? 'Opening…' : 'Manage in Lemon Squeezy'}
    </Button>
  );
}
