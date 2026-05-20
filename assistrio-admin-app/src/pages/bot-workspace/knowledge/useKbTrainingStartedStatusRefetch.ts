import { useEffect } from 'react';
import { useKbWorkspacePolling } from '@/context/KbWorkspacePollingContext';
import {
  ASSISTRIO_KB_TRAINING_STARTED,
  type AssistroKbTrainingStartedDetail,
  type KbTrainingAffectedType,
} from '@/lib/botSyncEvents';

/** After Retrain Agent succeeds, refetch only this section status once. */
export function useKbTrainingStartedStatusRefetch(
  botId: string | undefined,
  sectionType: KbTrainingAffectedType,
): void {
  const { refreshKnowledgeStatus } = useKbWorkspacePolling();

  useEffect(() => {
    if (!botId) return;

    const handler = (e: Event) => {
      const d = (e as CustomEvent<AssistroKbTrainingStartedDetail>).detail;
      if (!d || d.botId !== botId) return;
      const types = d.affectedTypes;
      if (types == null || types.length === 0) return;
      if (!types.includes(sectionType)) return;
      void refreshKnowledgeStatus(sectionType);
    };

    window.addEventListener(ASSISTRIO_KB_TRAINING_STARTED, handler);
    return () => window.removeEventListener(ASSISTRIO_KB_TRAINING_STARTED, handler);
  }, [botId, sectionType, refreshKnowledgeStatus]);
}
