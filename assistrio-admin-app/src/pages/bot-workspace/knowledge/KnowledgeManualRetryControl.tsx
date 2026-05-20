import { useState } from 'react';
import { postAdminBotKnowledgeItemRetry } from '@/api/adminApi';
import { appToast } from '@/lib/app-toast';
import { useKnowledgeStorageUx } from '@/context/KnowledgeStorageUxContext';
import {
  knowledgeManualRetryButtonLabel,
  type KnowledgeManualRetryStatusPick,
} from '@/lib/knowledgeManualRetry';
import { Button } from '@/components/ui';
import { requestWorkspaceBotRefresh } from '@/lib/botSyncEvents';

export function KnowledgeManualRetryControl(props: {
  botId: string;
  knowledgeItemId: string;
  statusPick: KnowledgeManualRetryStatusPick;
  isLabelOnlySuggestion?: boolean;
  onAfterSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { notifyPlanLimitFromApi } = useKnowledgeStorageUx();
  const label = knowledgeManualRetryButtonLabel(props.statusPick, {
    isLabelOnlySuggestion: props.isLabelOnlySuggestion,
  });
  if (!label) return null;

  async function run() {
    setBusy(true);
    try {
      const res = await postAdminBotKnowledgeItemRetry(props.botId, props.knowledgeItemId);
      if (!res.ok) {
        if (notifyPlanLimitFromApi(res)) {
          return;
        }
        if (res.errorCode === 'already_queued' || res.errorCode === 'already_processing') {
          appToast.info('This is already queued/running.');
          return;
        }
        if (res.errorCode === 'retry_rate_limited') {
          appToast.info(res.error || 'Please wait a moment before retrying.');
          return;
        }
        if (res.errorCode === 'manual_retry_cap_exceeded') {
          appToast.info(res.error || 'Manual retry limit reached for this item.');
          return;
        }
        appToast.error(res.error || 'Retry failed');
        return;
      }
      appToast.success('Retry started.');
      requestWorkspaceBotRefresh(props.botId);
      props.onAfterSuccess?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void run()}>
      {label}
    </Button>
  );
}
