import { useEffect } from 'react';
import { hasManualSaveDirty } from './workspaceManualSaveGuard';

/** Browser tab close / refresh warning when any manual-save section is dirty. */
export function WorkspaceBeforeUnload() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasManualSaveDirty()) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
  return null;
}
