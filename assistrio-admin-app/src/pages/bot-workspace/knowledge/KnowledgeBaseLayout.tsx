import { Outlet } from 'react-router-dom';
import { KnowledgeStorageUxProvider } from '@/context/KnowledgeStorageUxContext';

/**
 * Fills the editor column so sub-routes (e.g. Datasheets) can use full height. Bottom inset from widget preview.
 *
 * Training/status polling is owned by {@link KbWorkspacePollingProvider} to avoid duplicate `GET …/knowledge/training/status`
 * calls on every sub-route change.
 */
export function KnowledgeBaseLayout() {
  return (
    <KnowledgeStorageUxProvider>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </KnowledgeStorageUxProvider>
  );
}
