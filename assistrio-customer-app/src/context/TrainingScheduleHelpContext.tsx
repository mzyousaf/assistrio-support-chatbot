import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { KnowledgeTrainingScheduleHelpModal } from '@/components/knowledge/KnowledgeTrainingScheduleHelpModal';

type Ctx = {
  openTrainingScheduleHelp: () => void;
};

const TrainingScheduleHelpContext = createContext<Ctx | null>(null);

export function TrainingScheduleHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openTrainingScheduleHelp = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openTrainingScheduleHelp }), [openTrainingScheduleHelp]);

  return (
    <TrainingScheduleHelpContext.Provider value={value}>
      {children}
      <KnowledgeTrainingScheduleHelpModal open={open} onClose={() => setOpen(false)} />
    </TrainingScheduleHelpContext.Provider>
  );
}

/** No-op when used outside {@link TrainingScheduleHelpProvider}. */
export function useOptionalOpenTrainingScheduleHelp(): (() => void) | null {
  return useContext(TrainingScheduleHelpContext)?.openTrainingScheduleHelp ?? null;
}
