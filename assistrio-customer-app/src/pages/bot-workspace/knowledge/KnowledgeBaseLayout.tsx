import { Outlet } from 'react-router-dom';

/** Fills the editor column so sub-routes (e.g. Datasheets) can use full height. Bottom inset from widget preview. */
export function KnowledgeBaseLayout() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <Outlet />
    </div>
  );
}
