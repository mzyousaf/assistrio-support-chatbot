import { Outlet, useLocation } from 'react-router-dom';
import { WidgetPreviewContainer } from '@/layout/workspace-layout';
import { ChatWidgetPreview, WORKSPACE_WIDGET_PREVIEW_PANE } from './ChatWidgetPreview';
import { BehaviorWorkspaceProvider } from './BehaviorWorkspaceContext';

/**
 * One workspace shell for all playground sub-routes: editor (`<Outlet />`) + a **single** inline
 * widget preview with a **stable** portal `mountId` so the live embed does not remount on section changes.
 * Deploy & Go Live uses the same grid without the right-lane slot (matches prior `PublishWorkspacePage`); the
 * host still uses floating preview for that path.
 */
const PLAYGROUND_WIDGET_PREVIEW_MOUNT_ID = 'playground-widget-preview-root';

export function PlaygroundLayout() {
  const { pathname } = useLocation();
  const isDeployRoute = /\/playground\/deploy\/?$/.test(pathname);
  /** Maximize editor space: datasheet full-screen has its own top bar and no inline widget preview. */
  const isDatasheetFullscreen = /\/playground\/knowledgebase\/datasheets\/[^/]+\/fullscreen\/?$/.test(pathname);
  const hideWidgetPreview = isDeployRoute || isDatasheetFullscreen;

  return (
    <WidgetPreviewContainer
      editorFullWidth={isDatasheetFullscreen}
      previewMountId={PLAYGROUND_WIDGET_PREVIEW_MOUNT_ID}
      previewTitle={WORKSPACE_WIDGET_PREVIEW_PANE.title}
      previewDescription={WORKSPACE_WIDGET_PREVIEW_PANE.description}
      previewBodyClassName="min-h-0 px-2 py-2 sm:px-3 sm:py-2.5"
      preview={
        hideWidgetPreview
          ? undefined
          : ({ mountId }) => <ChatWidgetPreview mountId={mountId} />
      }
    >
      {/** Fills the widget editor column so nested layouts (e.g. knowledge) can use h-full / flex-1. Shared behavior
       *  draft state (e.g. suggestions / example questions) is available on knowledge routes without remounting. */}
      <BehaviorWorkspaceProvider>
        <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </BehaviorWorkspaceProvider>
    </WidgetPreviewContainer>
  );
}
