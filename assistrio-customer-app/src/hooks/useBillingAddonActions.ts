import { useCallback, useState } from 'react';
import { cancelWorkspaceAddon } from '@/api/customerApi';

export function useBillingAddonActions(workspaceId: string | null, onUpdated?: () => void) {
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelAddon = useCallback(
    async (addonKey: string, targetBotId?: string | null) => {
      if (!workspaceId) return false;
      setBusy(true);
      setErrorMessage(null);

      const result = await cancelWorkspaceAddon(workspaceId, {
        addonKey,
        targetBotId: targetBotId ?? undefined,
      });
      setBusy(false);

      if (!result.ok) {
        setErrorMessage(result.error ?? 'Could not cancel add-on.');
        return false;
      }

      onUpdated?.();
      return true;
    },
    [workspaceId, onUpdated],
  );

  return { busy, errorMessage, cancelAddon };
}
