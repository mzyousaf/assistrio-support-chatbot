import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  WORKSPACE_UNSAVED_MESSAGE,
  discardAllManualSaveGuards,
  discardManualSaveGuard,
  hasManualSaveDirty,
  hasManualSaveGuardDirty,
} from './workspaceManualSaveGuard';

type Pending = {
  resolve: (proceed: boolean) => void;
  mode: 'all' | 'knowledge-notes-only';
};

type WorkspaceDiscardContextValue = {
  /** Full manual-save discard (all registered guards). */
  requestDiscardIfNeeded: () => Promise<boolean>;
  /** Discard only the knowledge notes guard (KB sub-nav when notes are dirty). */
  requestDiscardKnowledgeNotesIfNeeded: () => Promise<boolean>;
};

const WorkspaceDiscardContext = createContext<WorkspaceDiscardContextValue | null>(null);

export function useWorkspaceDiscardModal(): WorkspaceDiscardContextValue {
  const ctx = useContext(WorkspaceDiscardContext);
  if (!ctx) {
    throw new Error('useWorkspaceDiscardModal must be used within WorkspaceDiscardModalProvider');
  }
  return ctx;
}

/**
 * In-app unsaved-changes confirmation (shared Modal). Browser beforeunload stays in WorkspaceBeforeUnload.
 */
export function WorkspaceDiscardModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  const finish = useCallback((proceed: boolean) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    p?.resolve(proceed);
  }, []);

  const requestDiscardIfNeeded = useCallback((): Promise<boolean> => {
    if (!hasManualSaveDirty()) return Promise.resolve(true);
    return new Promise((resolve) => {
      pendingRef.current = { resolve, mode: 'all' };
      setOpen(true);
    });
  }, []);

  const requestDiscardKnowledgeNotesIfNeeded = useCallback((): Promise<boolean> => {
    if (!hasManualSaveGuardDirty('knowledge-notes')) return Promise.resolve(true);
    return new Promise((resolve) => {
      pendingRef.current = { resolve, mode: 'knowledge-notes-only' };
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const p = pendingRef.current;
    if (!p) return;
    if (p.mode === 'all') {
      discardAllManualSaveGuards();
    } else {
      discardManualSaveGuard('knowledge-notes');
    }
    finish(true);
  }, [finish]);

  const handleCancel = useCallback(() => {
    finish(false);
  }, [finish]);

  const value = useMemo(
    () => ({ requestDiscardIfNeeded, requestDiscardKnowledgeNotesIfNeeded }),
    [requestDiscardIfNeeded, requestDiscardKnowledgeNotesIfNeeded],
  );

  return (
    <WorkspaceDiscardContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onClose={handleCancel}
        title="Discard unsaved changes?"
        description={WORKSPACE_UNSAVED_MESSAGE}
        tone="danger"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={handleConfirm}>
              Discard
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          You can save your work first, or discard and continue. This cannot be undone.
        </p>
      </Modal>
    </WorkspaceDiscardContext.Provider>
  );
}
